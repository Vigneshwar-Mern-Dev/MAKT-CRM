# MAKT Call Tracker API

The Android app is only an event collector. It must not create leads, assign users,
detect missed-call workflow, or store CRM state. The CRM API owns that logic.

## Required Environment

```env
CALL_TRACKER_REGISTRATION_SECRET="long-random-setup-secret"
```

Use this secret only while registering company-owned phones. After registration,
the Android app must authenticate with the returned `deviceToken`.

## Register Company Phone

`POST /api/call-tracker/register`

```json
{
  "registrationSecret": "setup-secret",
  "companyPhone": "+918888333553",
  "deviceId": "android-device-stable-id",
  "label": "Website Sales Phone"
}
```

Response:

```json
{
  "ok": true,
  "retryable": false,
  "serverTime": "2026-06-01T07:30:00.000Z",
  "companyPhone": {
    "id": "company-phone-id",
    "phoneNumber": "+918888333553",
    "label": "Website Sales Phone",
    "deviceId": "android-device-stable-id"
  },
  "deviceToken": "store-this-on-android-once"
}
```

Registration error response:

```json
{
  "ok": false,
  "code": "INVALID_REGISTRATION_SECRET",
  "error": "Unauthorized registration secret.",
  "retryable": false,
  "serverTime": "2026-06-01T07:30:02.000Z"
}
```

Registration error codes:

- `INVALID_REGISTRATION_SECRET`: the app secret does not match the CRM env value.
- `REGISTRATION_SECRET_NOT_CONFIGURED`: `CALL_TRACKER_REGISTRATION_SECRET` is missing in the deployed CRM environment.
- `INVALID_REGISTRATION_PAYLOAD`: `companyPhone` or `deviceId` was missing.
- `DEVICE_PHONE_CONFLICT`: the phone number and device ID are already linked to different CRM phone records.
- `REGISTRATION_FAILED`: database or unexpected server failure. Check CRM/Vercel logs.

## Send Call Event

`POST /api/call-tracker/events`

Header:

```http
Authorization: Bearer deviceToken
```

Body:

```json
{
  "eventId": "android-device-stable-id-20260601-0001",
  "deviceId": "android-device-stable-id",
  "companyPhone": "+918888333553",
  "caller": "+919876543210",
  "eventType": "RINGING",
  "callDirection": "INCOMING",
  "occurredAt": "2026-06-01T07:30:00.000Z",
  "callSessionLocalId": "android-local-call-session-id",
  "durationSeconds": 43,
  "androidCallLogId": "12345",
  "simSlot": 1,
  "simDisplayName": "Work SIM",
  "simCarrierName": "Airtel",
  "simSubscriptionId": "2",
  "localContactName": "John Doe",
  "retryCount": 0,
  "appVersion": "1.3.0",
  "androidVersion": "14",
  "deviceModel": "Samsung SM-A346E",
  "batteryPercent": 73,
  "isCharging": false,
  "chargingType": "USB",
  "networkType": "5G",
  "pendingSyncCount": 0,
  "lastSyncAttemptAt": "2026-06-01T07:30:02.000Z",
  "lastSuccessfulSyncAt": "2026-06-01T07:30:02.000Z",
  "lastSyncError": null,
  "syncRetryCount": 0,
  "permissionStatus": {
    "readPhoneState": true,
    "readCallLog": true,
    "readContacts": true,
    "notifications": true,
    "batteryOptimizationIgnored": true
  }
}
```

Supported `eventType` values:

```text
RINGING
ANSWERED
ENDED
MISSED
```

Supported `callDirection` values:

```text
INCOMING
OUTGOING
UNKNOWN
```

Every event must have a stable unique `eventId`. If Android retries the same
event, the backend will treat it as a duplicate instead of creating another lead.

Use `eventType` for the call state and `callDirection` for incoming vs outgoing.
Do not send `OUTGOING` as an `eventType`; that is a direction, not a call state.

Optional metadata rules:

- `callSessionLocalId` should be stable for every event belonging to the same call.
- `localContactName` is stored as a hint. It should not be treated as verified CRM identity.
- `simSlot`, `simDisplayName`, `simCarrierName`, and `simSubscriptionId` identify which SIM handled the call.
- `retryCount`, `pendingSyncCount`, `lastSyncError`, and sync timestamps help diagnose offline/DNS failures.
- `permissionStatus` should report exact Android permission/background states.

Success response:

```json
{
  "ok": true,
  "retryable": false,
  "serverTime": "2026-06-01T07:30:02.000Z",
  "duplicate": false,
  "eventId": "database-event-id",
  "sessionId": "database-session-id",
  "leadId": "database-lead-id",
  "status": "RINGING"
}
```

## Heartbeat

`POST /api/call-tracker/heartbeat`

Header:

```http
Authorization: Bearer deviceToken
```

Body:

```json
{
  "deviceId": "android-device-stable-id",
  "appVersion": "1.3.0",
  "androidVersion": "14",
  "deviceModel": "Samsung SM-A346E",
  "batteryPercent": 73,
  "isCharging": false,
  "chargingType": "USB",
  "networkType": "5G",
  "pendingSyncCount": 0,
  "lastSyncAttemptAt": "2026-06-01T07:30:02.000Z",
  "lastSuccessfulSyncAt": "2026-06-01T07:30:02.000Z",
  "lastSyncError": null,
  "lastSyncErrorAt": null,
  "syncRetryCount": 0,
  "permissionStatus": {
    "readPhoneState": true,
    "readCallLog": true,
    "readContacts": true,
    "notifications": true,
    "batteryOptimizationIgnored": true
  }
}
```

Heartbeat should run even when no calls happen. The CRM marks a phone offline
after 15 minutes without heartbeat.

Success response:

```json
{
  "ok": true,
  "retryable": false,
  "serverTime": "2026-06-01T07:30:02.000Z"
}
```

## Android Retry Rules

All call-tracker API responses include `ok`, `retryable`, and `serverTime`.

```json
{
  "ok": false,
  "error": "Unauthorized device.",
  "retryable": false,
  "serverTime": "2026-06-01T07:30:02.000Z"
}
```

Use these rules in the app:

- HTTP `200`: mark the local item synced. If `duplicate` is true, also mark it synced.
- HTTP `400`: do not retry automatically. The payload is invalid.
- HTTP `401`: do not retry automatically. The device token or registration is wrong.
- HTTP `500` or network/DNS/timeout failure: keep pending and retry with WorkManager.
- Do not parse the English `error` string to decide retry behavior. Use `retryable`.

## CRM Queue APIs

Authenticated CRM users can read:

```text
GET /api/calls/live
GET /api/calls/missed
```

Authenticated CRM users can claim:

```text
POST /api/calls/:callSessionId/claim
```

Authenticated CRM users can record workflow:

```text
POST /api/call-leads/:leadId/notes
POST /api/call-leads/:leadId/follow-ups
```

Notes body:

```json
{
  "note": "Customer asked for callback after 5 PM."
}
```

Follow-up body:

```json
{
  "dueAt": "2026-06-01T12:00:00.000Z",
  "note": "Call again after customer checks documents.",
  "assignedToId": "optional-user-id"
}
```
