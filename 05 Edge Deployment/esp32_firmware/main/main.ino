/*
 * CyphEV - ESP32 Edge Inference Firmware
 *
 * Performs ON-DEVICE feature extraction and ML inference.
 * The laptop (simulating an OBD-II port) streams raw sensor data;
 * the ESP32 handles windowing, statistics, and prediction.
 *
 * ── Two operating modes ──
 *
 * REALTIME mode (SoC + Range):
 *   Laptop streams raw 10 Hz sensor rows over serial.
 *   ESP32 accumulates a 600-sample rolling window. Every 200 new
 *   samples it extracts statistical features and runs XGBoost inference.
 *
 *   Laptop → ESP32:  "RT:time,voltage,current,soc,velocity,accel,torque,btemp,atemp,hvac,elevation,throttle,regen,is_winter\n"
 *   ESP32 → Laptop:  "PRED:SOC:value:latency_us\n"  and/or  "PRED:RANGE:value:latency_us\n"
 *
 * CYCLE mode (SoH + RUL):
 *   Laptop sends per-cycle discharge summaries (what a real BMS reports
 *   after each charge/discharge cycle).
 *   ESP32 maintains a small cycle history and computes rolling/lag/delta
 *   features, then runs linear model inference.
 *
 *   Laptop → ESP32:  "CYC:battery_id,cycle,capacity,v_mean,v_std,v_min,v_max,v_range,i_mean,i_std,i_min,i_max,t_mean,t_std,t_max,t_rise,discharge_time,energy,Re,Rct\n"
 *   ESP32 → Laptop:  "PRED:SOH:value:latency_us\n"  and  "PRED:RUL:value:latency_us\n"
 *
 * Control commands:
 *   "RESET\n"   — clear all buffers and history
 *   "STATUS\n"  — print buffer fill / cycle count
 */

#include <math.h>
#include <string.h>
#include <stdlib.h>
#include "models/model_soc.h"
#include "models/model_range.h"
#include "models/model_soh.h"
#include "models/model_rul.h"

// ─── Configuration ───────────────────────────────────────────────────────────
#define SERIAL_BAUD    115200
#define MAX_LINE_LEN   1024

// Realtime window parameters (must match training pipeline)
#define RT_WINDOW      600
#define RT_STRIDE      200
#define RT_N_RAW       14   // raw sensor channels per sample
#define RT_N_CHANNELS  18   // raw + 4 cumulative channels stored per sample

// Cycle history depth (for rolling/lag features)
#define CYC_MAX_HISTORY 200
#define CYC_N_RAW       20  // fields per cycle row (including battery_id mapped to int)

// ─── Realtime circular buffer ────────────────────────────────────────────────
// Channels: time, voltage, current, soc, velocity, accel, torque,
//           btemp, atemp, hvac, elevation, throttle, regen, is_winter
enum RTChan {
  CH_TIME=0, CH_VOLT, CH_CURR, CH_SOC, CH_VEL, CH_ACCEL, CH_TORQUE,
  CH_BTEMP, CH_ATEMP, CH_HVAC, CH_ELEV, CH_THROTTLE, CH_REGEN, CH_WINTER,
  // Cumulative channels (computed on ingest, stored per-sample for midpoint lookup)
  CH_CUM_AH, CH_CUM_WH, CH_CUM_DIST, CH_ELAPSED
};

static float rtBuf[RT_N_CHANNELS][RT_WINDOW];  // circular buffer
static int   rtHead = 0;        // next write position
static int   rtCount = 0;       // total samples received (for stride tracking)
static int   rtFilled = 0;      // how many valid samples in buffer (up to RT_WINDOW)

// Cumulative accumulators (tracked across entire trip, not just window)
static float cumAh = 0.0f;
static float cumWh = 0.0f;
static float cumDistKm = 0.0f;
static float tripStartTime = 0.0f;
static float lastTime = 0.0f;
static bool  tripStarted = false;

// ─── Cycle history buffer ────────────────────────────────────────────────────
// Per-cycle raw fields: cycle, capacity, v_mean..Rct (18 values) + SoH (computed)
#define CF_CYCLE       0
#define CF_CAPACITY    1
#define CF_V_MEAN      2
#define CF_V_STD       3
#define CF_V_MIN       4
#define CF_V_MAX       5
#define CF_V_RANGE     6
#define CF_I_MEAN      7
#define CF_I_STD       8
#define CF_I_MIN       9
#define CF_I_MAX       10
#define CF_T_MEAN      11
#define CF_T_STD       12
#define CF_T_MAX       13
#define CF_T_RISE      14
#define CF_DISCHARGE_T 15
#define CF_ENERGY      16
#define CF_RE          17
#define CF_RCT         18
#define CF_SOH         19  // computed: capacity / 2.0 * 100
#define CF_N_FIELDS    20

static float cycHist[CYC_MAX_HISTORY][CF_N_FIELDS];
static int   cycCount = 0;  // total cycles stored

// ─── Serial line buffer ──────────────────────────────────────────────────────
static char lineBuf[MAX_LINE_LEN];
static int  linePos = 0;

// ─── Helper: parse comma-separated floats ────────────────────────────────────
int parseFloats(const char *str, float *out, int maxCount) {
  int count = 0;
  const char *p = str;
  while (*p && count < maxCount) {
    char *end;
    float val = strtof(p, &end);
    if (end == p) break;
    out[count++] = val;
    p = end;
    if (*p == ',') p++;
  }
  return count;
}

// ─── Helper: window statistics ───────────────────────────────────────────────
// These operate on the circular buffer, reading the last `rtFilled` samples.

// Get value from circular buffer for channel ch, at position i (0 = oldest)
static inline float rbGet(int ch, int i) {
  int idx = (rtHead - rtFilled + i + RT_WINDOW) % RT_WINDOW;
  return rtBuf[ch][idx];
}

float chanMean(int ch, int n) {
  float sum = 0;
  for (int i = 0; i < n; i++) sum += rbGet(ch, i);
  return sum / n;
}

float chanMax(int ch, int n) {
  float mx = rbGet(ch, 0);
  for (int i = 1; i < n; i++) { float v = rbGet(ch, i); if (v > mx) mx = v; }
  return mx;
}

float chanMin(int ch, int n) {
  float mn = rbGet(ch, 0);
  for (int i = 1; i < n; i++) { float v = rbGet(ch, i); if (v < mn) mn = v; }
  return mn;
}

float chanStd(int ch, int n) {
  float mean = chanMean(ch, n);
  float sum = 0;
  for (int i = 0; i < n; i++) { float d = rbGet(ch, i) - mean; sum += d * d; }
  return sqrtf(sum / n);
}

// Percentile (simple nearest-rank, uses a temp sort buffer)
static float sortBuf[RT_WINDOW];
float chanPercentile(int ch, int n, float pct) {
  for (int i = 0; i < n; i++) sortBuf[i] = rbGet(ch, i);
  // Simple insertion sort (n=600, fast enough on ESP32)
  for (int i = 1; i < n; i++) {
    float key = sortBuf[i];
    int j = i - 1;
    while (j >= 0 && sortBuf[j] > key) { sortBuf[j+1] = sortBuf[j]; j--; }
    sortBuf[j+1] = key;
  }
  int idx = (int)(pct / 100.0f * (n - 1));
  return sortBuf[idx];
}

// Fraction of window where accel < threshold
float chanFracBelow(int ch, int n, float threshold) {
  int cnt = 0;
  for (int i = 0; i < n; i++) if (rbGet(ch, i) < threshold) cnt++;
  return (float)cnt / n * 100.0f;
}

// Product channel: compute stats on element-wise product of two channels
float prodMean(int chA, int chB, int n) {
  float sum = 0;
  for (int i = 0; i < n; i++) sum += rbGet(chA, i) * rbGet(chB, i);
  return sum / n;
}

float prodMax(int chA, int chB, int n) {
  float mx = rbGet(chA, 0) * rbGet(chB, 0);
  for (int i = 1; i < n; i++) { float v = rbGet(chA, i) * rbGet(chB, i); if (v > mx) mx = v; }
  return mx;
}

// ─── Realtime feature extraction + inference ─────────────────────────────────

void realtimeInference() {
  int n = rtFilled;  // should be RT_WINDOW
  int mid = n / 2;   // midpoint index within window (0 = oldest)

  // Cumulative values at window midpoint (read from stored snapshots)
  float midCumAh   = rbGet(CH_CUM_AH, mid);
  float midCumWh   = rbGet(CH_CUM_WH, mid);
  float midCumDist = rbGet(CH_CUM_DIST, mid);
  float elapsed    = rbGet(CH_ELAPSED, mid);

  // ── SoC features (22) ──
  // Order must match train_and_export.py: Avg_Voltage, Avg_Current, Avg_Power,
  // Avg_Velocity, Avg_Accel, Avg_Torque, Avg_Battery_Temp, Avg_Ambient_Temp,
  // Avg_HVAC, Max_Current, Min_Current, Std_Current, Std_Velocity, Max_Power,
  // Min_Voltage, Cumulative_Ah, Cumulative_Wh, Cumulative_Dist_km, Elapsed_s,
  // Elevation_Change, Temp_Diff, Is_Winter
  float socFeats[22];
  socFeats[0]  = chanMean(CH_VOLT, n);
  socFeats[1]  = chanMean(CH_CURR, n);
  socFeats[2]  = prodMean(CH_VOLT, CH_CURR, n);  // Avg_Power
  socFeats[3]  = chanMean(CH_VEL, n);
  socFeats[4]  = chanMean(CH_ACCEL, n);
  socFeats[5]  = chanMean(CH_TORQUE, n);
  socFeats[6]  = chanMean(CH_BTEMP, n);
  socFeats[7]  = chanMean(CH_ATEMP, n);
  socFeats[8]  = chanMean(CH_HVAC, n);
  socFeats[9]  = chanMax(CH_CURR, n);
  socFeats[10] = chanMin(CH_CURR, n);
  socFeats[11] = chanStd(CH_CURR, n);
  socFeats[12] = chanStd(CH_VEL, n);
  socFeats[13] = prodMax(CH_VOLT, CH_CURR, n);   // Max_Power
  socFeats[14] = chanMin(CH_VOLT, n);
  socFeats[15] = midCumAh;
  socFeats[16] = midCumWh;
  socFeats[17] = midCumDist;
  socFeats[18] = elapsed;
  socFeats[19] = rbGet(CH_ELEV, n-1) - rbGet(CH_ELEV, 0);  // Elevation_Change
  socFeats[20] = chanMean(CH_BTEMP, n) - chanMean(CH_ATEMP, n);  // Temp_Diff
  socFeats[21] = rbGet(CH_WINTER, 0);  // Is_Winter (constant for trip)

  unsigned long t0 = micros();
  float socPred = soc_predict(socFeats);
  unsigned long socUs = micros() - t0;

  Serial.print("PRED:SOC:");
  Serial.print(socPred, 4);
  Serial.print(":");
  Serial.print(socUs);
  Serial.println("us");

  // ── Range features (24) ──
  // Check minimum speed/distance constraints
  float avgSpeed = chanMean(CH_VEL, n);
  if (avgSpeed >= 3.0f) {
    // Approximate window distance
    float windowDist = 0;
    for (int i = 1; i < n; i++) {
      float dt = rbGet(CH_TIME, i) - rbGet(CH_TIME, i-1);
      if (dt < 0) dt = 0.1f;  // fallback for wrap-around
      windowDist += fabsf(rbGet(CH_VEL, i)) / 3600.0f * dt;
    }

    if (windowDist >= 0.2f) {
      float rangeFeats[24];
      rangeFeats[0]  = rbGet(CH_SOC, 0);                    // SOC (window start)
      rangeFeats[1]  = chanMean(CH_VOLT, n);                 // Voltage_avg
      rangeFeats[2]  = chanMean(CH_CURR, n);                 // Current_avg
      rangeFeats[3]  = prodMean(CH_VOLT, CH_CURR, n);       // Power_avg
      rangeFeats[4]  = chanMean(CH_BTEMP, n);               // Battery_Temp
      rangeFeats[5]  = chanMean(CH_ATEMP, n);               // Ambient_Temp
      rangeFeats[6]  = chanMean(CH_VEL, n);                 // Velocity_avg
      rangeFeats[7]  = chanStd(CH_VEL, n);                  // Velocity_std
      rangeFeats[8]  = chanMax(CH_VEL, n);                  // Velocity_max
      rangeFeats[9]  = chanPercentile(CH_VEL, n, 25.0f);   // Velocity_p25
      rangeFeats[10] = chanPercentile(CH_VEL, n, 75.0f);   // Velocity_p75
      rangeFeats[11] = chanMean(CH_ACCEL, n);               // Accel_avg
      rangeFeats[12] = chanStd(CH_ACCEL, n);                // Accel_std
      rangeFeats[13] = chanFracBelow(CH_ACCEL, n, -2.0f);  // Hard_Brake_pct
      rangeFeats[14] = chanMean(CH_THROTTLE, n);            // Throttle_avg
      rangeFeats[15] = chanMean(CH_TORQUE, n);              // Torque_avg
      rangeFeats[16] = chanStd(CH_TORQUE, n);               // Torque_std
      rangeFeats[17] = rbGet(CH_ELEV, n-1) - rbGet(CH_ELEV, 0);  // Elev_change
      rangeFeats[18] = chanStd(CH_ELEV, n);                 // Elev_std
      rangeFeats[19] = chanMean(CH_HVAC, n);                // HVAC_power
      rangeFeats[20] = rbGet(CH_WINTER, 0);                 // Is_Winter
      rangeFeats[21] = rbGet(CH_TIME, n-1) - rbGet(CH_TIME, 0);  // Window_time_s

      // Regen_pct: fraction of window where regen > 0
      int regenCnt = 0;
      for (int i = 0; i < n; i++) if (rbGet(CH_REGEN, i) > 0) regenCnt++;
      rangeFeats[22] = (float)regenCnt / n * 100.0f;

      rangeFeats[23] = chanMean(CH_BTEMP, n) - chanMean(CH_ATEMP, n);  // Temp_diff

      t0 = micros();
      float rangePred = range_predict(rangeFeats);
      unsigned long rangeUs = micros() - t0;

      Serial.print("PRED:RANGE:");
      Serial.print(rangePred, 4);
      Serial.print(":");
      Serial.print(rangeUs);
      Serial.println("us");
    }
  }
}

// ─── Process a realtime sensor row ───────────────────────────────────────────

void processRT(const char *data) {
  float vals[RT_N_RAW];
  int n = parseFloats(data, vals, RT_N_RAW);
  if (n != RT_N_RAW) {
    Serial.print("ERR:RT expects ");
    Serial.print(RT_N_RAW);
    Serial.print(" channels, got ");
    Serial.println(n);
    return;
  }

  // Update cumulative accumulators
  float curTime = vals[CH_TIME];
  if (!tripStarted) {
    tripStartTime = curTime;
    lastTime = curTime;
    tripStarted = true;
  } else {
    float dt = curTime - lastTime;
    if (dt < 0) dt = 0.1f;
    float power = vals[CH_VOLT] * vals[CH_CURR];
    cumAh += vals[CH_CURR] * dt / 3600.0f;
    cumWh += power * dt / 3600.0f;
    cumDistKm += fabsf(vals[CH_VEL]) / 3600.0f * dt;
    lastTime = curTime;
  }

  // Store raw channels in circular buffer
  for (int ch = 0; ch < RT_N_RAW; ch++) {
    rtBuf[ch][rtHead] = vals[ch];
  }
  // Store cumulative snapshots at this sample position
  rtBuf[CH_CUM_AH][rtHead]   = cumAh;
  rtBuf[CH_CUM_WH][rtHead]   = cumWh;
  rtBuf[CH_CUM_DIST][rtHead] = cumDistKm;
  rtBuf[CH_ELAPSED][rtHead]  = curTime - tripStartTime;

  rtHead = (rtHead + 1) % RT_WINDOW;
  if (rtFilled < RT_WINDOW) rtFilled++;
  rtCount++;

  // Check if we should run inference (every STRIDE samples, once buffer is full)
  if (rtFilled >= RT_WINDOW && (rtCount % RT_STRIDE) == 0) {
    realtimeInference();
  }
}

// ─── Cycle mode: SoH + RUL ──────────────────────────────────────────────────

void processCycle(const char *data) {
  // Parse: battery_id(ignored),cycle,capacity,v_mean,...,Rct  (20 values total)
  // battery_id is a string — we skip it and parse the rest
  // Format: "B0005,1,1.856,3.48,..."
  //          ^skip  ^parse 19 floats

  // Skip battery_id (find first comma)
  const char *p = strchr(data, ',');
  if (!p) {
    Serial.println("ERR:CYC missing battery_id separator");
    return;
  }
  p++;  // skip past comma

  float vals[19];  // cycle, capacity, v_mean..Rct
  int n = parseFloats(p, vals, 19);
  if (n != 19) {
    Serial.print("ERR:CYC expects 19 numeric fields after battery_id, got ");
    Serial.println(n);
    return;
  }

  // Store in cycle history
  int idx = cycCount % CYC_MAX_HISTORY;
  cycHist[idx][CF_CYCLE]       = vals[0];
  cycHist[idx][CF_CAPACITY]    = vals[1];
  cycHist[idx][CF_V_MEAN]      = vals[2];
  cycHist[idx][CF_V_STD]       = vals[3];
  cycHist[idx][CF_V_MIN]       = vals[4];
  cycHist[idx][CF_V_MAX]       = vals[5];
  cycHist[idx][CF_V_RANGE]     = vals[6];
  cycHist[idx][CF_I_MEAN]      = vals[7];
  cycHist[idx][CF_I_STD]       = vals[8];
  cycHist[idx][CF_I_MIN]       = vals[9];
  cycHist[idx][CF_I_MAX]       = vals[10];
  cycHist[idx][CF_T_MEAN]      = vals[11];
  cycHist[idx][CF_T_STD]       = vals[12];
  cycHist[idx][CF_T_MAX]       = vals[13];
  cycHist[idx][CF_T_RISE]      = vals[14];
  cycHist[idx][CF_DISCHARGE_T] = vals[15];
  cycHist[idx][CF_ENERGY]      = vals[16];
  cycHist[idx][CF_RE]          = vals[17];
  cycHist[idx][CF_RCT]         = vals[18];

  float capacity = vals[1];
  float soh = (capacity / 2.0f) * 100.0f;  // RATED_CAPACITY = 2.0 Ah
  cycHist[idx][CF_SOH] = soh;

  cycCount++;
  int total = (cycCount < CYC_MAX_HISTORY) ? cycCount : CYC_MAX_HISTORY;

  // Helper to get field from history (0 = oldest available, total-1 = current)
  #define CHIST(offset, field) cycHist[((cycCount - total + (offset)) % CYC_MAX_HISTORY)][field]
  #define CUR(field) CHIST(total - 1, field)
  #define PREV(field, lag) ((total > (lag)) ? CHIST(total - 1 - (lag), field) : CUR(field))

  // ── SoH prediction (10 base features) ──
  // Top 10: energy, Rct, t_mean, t_max, v_std, discharge_time, i_mean, v_max, t_rise, Re
  float sohFeats[10];
  sohFeats[0] = CUR(CF_ENERGY);
  sohFeats[1] = CUR(CF_RCT);
  sohFeats[2] = CUR(CF_T_MEAN);
  sohFeats[3] = CUR(CF_T_MAX);
  sohFeats[4] = CUR(CF_V_STD);
  sohFeats[5] = CUR(CF_DISCHARGE_T);
  sohFeats[6] = CUR(CF_I_MEAN);
  sohFeats[7] = CUR(CF_V_MAX);
  sohFeats[8] = CUR(CF_T_RISE);
  sohFeats[9] = CUR(CF_RE);

  unsigned long t0 = micros();
  float sohPred = soh_predict(sohFeats);
  unsigned long sohUs = micros() - t0;

  Serial.print("PRED:SOH:");
  Serial.print(sohPred, 4);
  Serial.print(":");
  Serial.print(sohUs);
  Serial.println("us");

  // ── RUL prediction (42 features) ──
  // Need enough history for rolling/lag features
  if (total < 3) {
    Serial.println("INFO:RUL needs 3+ cycles, buffering...");
    return;
  }

  float cycle   = CUR(CF_CYCLE);
  float curSoH  = CUR(CF_SOH);
  float curCap  = CUR(CF_CAPACITY);
  float curRe   = CUR(CF_RE);

  // Delta features (current - previous)
  float sohDelta    = curSoH - PREV(CF_SOH, 1);
  float capDelta    = curCap - PREV(CF_CAPACITY, 1);
  float reDelta     = curRe  - PREV(CF_RE, 1);
  float energyDelta = CUR(CF_ENERGY) - PREV(CF_ENERGY, 1);

  // SoH_rate: (first_SoH - current_SoH) / (cycle - first_cycle + 1)
  float firstSoH   = CHIST(0, CF_SOH);
  float firstCycle  = CHIST(0, CF_CYCLE);
  float sohRate = (firstSoH - curSoH) / (cycle - firstCycle + 1.0f);

  // cap_fade: (first_cap - current_cap) / first_cap
  float firstCap = CHIST(0, CF_CAPACITY);
  float capFade = (firstCap > 0) ? (firstCap - curCap) / firstCap : 0;

  // Rolling means/stds for capacity (window 3 and 5)
  float capRoll3 = 0, capRoll5 = 0, capStd3 = 0, capStd5 = 0;
  {
    int w3 = (total < 3) ? total : 3;
    int w5 = (total < 5) ? total : 5;
    float sum3 = 0, sum5 = 0;
    for (int i = 0; i < w5; i++) {
      float c = CHIST(total - 1 - i, CF_CAPACITY);
      sum5 += c;
      if (i < w3) sum3 += c;
    }
    capRoll3 = sum3 / w3;
    capRoll5 = sum5 / w5;

    float var3 = 0, var5 = 0;
    for (int i = 0; i < w5; i++) {
      float c = CHIST(total - 1 - i, CF_CAPACITY);
      float d5 = c - capRoll5; var5 += d5 * d5;
      if (i < w3) { float d3 = c - capRoll3; var3 += d3 * d3; }
    }
    capStd3 = (w3 > 1) ? sqrtf(var3 / (w3 - 1)) : 0;
    capStd5 = (w5 > 1) ? sqrtf(var5 / (w5 - 1)) : 0;
  }

  // Lag features
  float sohLag1 = PREV(CF_SOH, 1);
  float sohLag2 = PREV(CF_SOH, 2);
  float sohLag3 = (total > 3) ? CHIST(total - 4, CF_SOH) : curSoH;
  float capLag1 = PREV(CF_CAPACITY, 1);
  float capLag2 = PREV(CF_CAPACITY, 2);
  float capLag3 = (total > 3) ? CHIST(total - 4, CF_CAPACITY) : curCap;
  float reLag1  = PREV(CF_RE, 1);
  float reLag2  = PREV(CF_RE, 2);

  // Interaction features
  float sohXrate  = curSoH * sohRate;
  float sohXdelta = curSoH * sohDelta;
  float capXRe    = curCap * curRe;
  float sohSq     = curSoH * curSoH;
  float capFadeSq = capFade * capFade;

  // Build the 42-feature vector (exact order from train_and_export.py)
  float rulFeats[42];
  rulFeats[0]  = cycle;
  rulFeats[1]  = curSoH;
  rulFeats[2]  = CUR(CF_V_MEAN);
  rulFeats[3]  = CUR(CF_V_STD);
  rulFeats[4]  = CUR(CF_V_MIN);
  rulFeats[5]  = CUR(CF_V_MAX);
  rulFeats[6]  = CUR(CF_V_RANGE);
  rulFeats[7]  = CUR(CF_I_MEAN);
  rulFeats[8]  = CUR(CF_I_STD);
  rulFeats[9]  = CUR(CF_I_MIN);
  rulFeats[10] = CUR(CF_I_MAX);
  rulFeats[11] = CUR(CF_T_MEAN);
  rulFeats[12] = CUR(CF_T_STD);
  rulFeats[13] = CUR(CF_T_MAX);
  rulFeats[14] = CUR(CF_T_RISE);
  rulFeats[15] = CUR(CF_DISCHARGE_T);
  rulFeats[16] = CUR(CF_ENERGY);
  rulFeats[17] = curRe;
  rulFeats[18] = CUR(CF_RCT);
  rulFeats[19] = sohDelta;
  rulFeats[20] = capDelta;
  rulFeats[21] = reDelta;
  rulFeats[22] = energyDelta;
  rulFeats[23] = sohRate;
  rulFeats[24] = capFade;
  rulFeats[25] = capRoll3;
  rulFeats[26] = capRoll5;
  rulFeats[27] = capStd3;
  rulFeats[28] = capStd5;
  rulFeats[29] = sohLag1;
  rulFeats[30] = sohLag2;
  rulFeats[31] = sohLag3;
  rulFeats[32] = capLag1;
  rulFeats[33] = capLag2;
  rulFeats[34] = capLag3;
  rulFeats[35] = reLag1;
  rulFeats[36] = reLag2;
  rulFeats[37] = sohXrate;
  rulFeats[38] = sohXdelta;
  rulFeats[39] = capXRe;
  rulFeats[40] = sohSq;
  rulFeats[41] = capFadeSq;

  t0 = micros();
  float rulPred = rul_predict(rulFeats);
  unsigned long rulUs = micros() - t0;

  Serial.print("PRED:RUL:");
  Serial.print(rulPred, 4);
  Serial.print(":");
  Serial.print(rulUs);
  Serial.println("us");

  #undef CHIST
  #undef CUR
  #undef PREV
}

// ─── Reset all state ─────────────────────────────────────────────────────────

void resetAll() {
  rtHead = 0; rtCount = 0; rtFilled = 0;
  cumAh = 0; cumWh = 0; cumDistKm = 0;
  tripStarted = false;
  cycCount = 0;
  memset(rtBuf, 0, sizeof(rtBuf));
  memset(cycHist, 0, sizeof(cycHist));
  Serial.println("OK:reset");
}

// ─── Process incoming line ───────────────────────────────────────────────────

void processLine(const char *line) {
  if (strncmp(line, "RT:", 3) == 0) {
    processRT(line + 3);
  } else if (strncmp(line, "CYC:", 4) == 0) {
    processCycle(line + 4);
  } else if (strcmp(line, "RESET") == 0) {
    resetAll();
  } else if (strcmp(line, "STATUS") == 0) {
    Serial.print("STATUS:rt_filled=");
    Serial.print(rtFilled);
    Serial.print("/");
    Serial.print(RT_WINDOW);
    Serial.print(",rt_total=");
    Serial.print(rtCount);
    Serial.print(",cycles=");
    Serial.println(cycCount);
  } else {
    Serial.print("ERR:unknown command '");
    Serial.print(line);
    Serial.println("'");
  }
}

// ─── Arduino entry points ────────────────────────────────────────────────────

void setup() {
  Serial.begin(SERIAL_BAUD);
  while (!Serial) { delay(10); }

  Serial.println("READY");
  Serial.println("CyphEV Edge Inference v2.0 — On-Device Feature Extraction");
  Serial.println("Modes:");
  Serial.println("  RT:<time,volt,curr,soc,vel,accel,torque,btemp,atemp,hvac,elev,throttle,regen,is_winter>");
  Serial.println("  CYC:<battery_id,cycle,cap,v_mean,v_std,v_min,v_max,v_range,i_mean,i_std,i_min,i_max,t_mean,t_std,t_max,t_rise,dtime,energy,Re,Rct>");
  Serial.println("  RESET | STATUS");
  Serial.print("RAM free: ");
  Serial.print(ESP.getFreeHeap());
  Serial.println(" bytes");
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (linePos > 0) {
        lineBuf[linePos] = '\0';
        processLine(lineBuf);
        linePos = 0;
      }
    } else {
      if (linePos < MAX_LINE_LEN - 1) {
        lineBuf[linePos++] = c;
      } else {
        Serial.println("ERR:line overflow");
        linePos = 0;
      }
    }
  }
}
