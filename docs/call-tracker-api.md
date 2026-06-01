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
  "companyPhone": {
    "id": "company-phone-id",
    "phoneNumber": "+918888333553",
    "label": "Website Sales Phone",
    "deviceId": "android-device-stable-id"
  },
  "deviceToken": "store-this-on-android-once"
}
```

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
  "occurredAt": "2026-06-01T07:30:00.000Z"
}
```

Supported `eventType` values:

```text
RINGING
ANSWERED
ENDED
MISSED
```

Every event must have a stable unique `eventId`. If Android retries the same
event, the backend will treat it as a duplicate instead of creating another lead.

## Heartbeat

`POST /api/call-tracker/heartbeat`

Header:

```http
Authorization: Bearer deviceToken
```

Body:

```json
{
  "deviceId": "android-device-stable-id"
}
```

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
