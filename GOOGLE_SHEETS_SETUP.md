# Google Sheets Approval Workflow

This version uses Google Sheets as the review console and source of truth for approved manual additions and provider change requests.

## Workbook

Create a Google Sheet named `Provider Network Submissions and Approvals`.

The Apps Script in `google_apps_script.gs` will create these tabs automatically the first time it runs:

- `Provider Submissions`
- `Category Submissions`
- `User Logins`

The `Provider Submissions` and `Category Submissions` tabs include a `submitted_by` column. When a logged-in user submits an add/edit/delete request from the map, this column is filled from their active login session, for example:

```text
User Name <user@example.com>
```

Reviewers approve rows by changing `review_status` to `Approved`. Rows left as `Pending` stay out of the public map. Rows marked `Rejected` are ignored.

Provider rows use `change_action` to decide what happens after approval:

- `Add` publishes a new provider.
- `Edit` updates the matching provider.
- `Delete` hides the matching provider from the public map.

If provider latitude/longitude are blank, or accidentally set to `0` / `0`, the Apps Script tries to geocode the provider from its address, city, and country after approval.

Phone numbers that start with `+` are stored as plain text so Google Sheets does not interpret them as formulas.

## Proof-of-Concept Login

The login layer is a soft proof-of-concept gate. It improves normal user access flow, but it is not enterprise-grade security while the app remains on public static hosting. A future official deployment should replace this with company SSO.

The Apps Script creates a `User Logins` tab with these headers:

```text
email, password_hash, name, role, status, created_at, last_login, last_login_status, session_token, session_expires_at, notes
```

To add a user:

1. Open `password_hash.html` in the deployed site or local workspace.
2. Enter the user's email and temporary password.
3. Copy the generated hash.
4. Add a row to `User Logins`:
   - `email`: the user's lowercase email.
   - `password_hash`: the generated hash.
   - `name`: optional display name.
   - `role`: optional, for example `admin` or `viewer`.
   - `status`: `Active`.
   - `created_at`: today's date or timestamp.
5. Keep `session_token` and `session_expires_at` blank.

Users can also request access from the login page:

1. The user opens `login.html` and selects `Request access`.
2. The browser hashes their password before sending the request.
3. Apps Script adds or updates a row in `User Logins` with:
   - `status`: `Pending`
   - `role`: `viewer`
   - `last_login_status`: `Registration pending`
4. To approve the user, change their `status` from `Pending` to `Active`.
5. To reject the user, leave the row as `Pending`, change it to `Rejected`, or delete the row.

Only rows with `status` exactly set to `Active` can sign in.

The hash is generated as:

```text
SHA-256(lowercase_email + ":" + password)
```

After the updated Apps Script is deployed and at least one active user exists, enable the login gate in `sheets_config.js`:

```js
window.providerSheetsConfig = {
  enabled: true,
  authEnabled: true,
  sessionDurationHours: 8,
  appsScriptUrl: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
};
```

If `authEnabled` is `false`, the map remains open as before.

## Apps Script Bridge: Bound Script

1. In the Google Sheet, open `Extensions > Apps Script`.
2. Paste the contents of `google_apps_script.gs`.
3. Save the Apps Script project.
4. Deploy it as a web app:
   - Execute as: `Me`
   - Who has access: `Anyone`
5. Copy the web app `/exec` URL.

## Apps Script Bridge: Standalone Fallback

Use this if `Extensions > Apps Script` does not open from the Sheet.

1. Open `https://script.google.com/create`.
2. Paste the contents of `google_apps_script.gs`.
3. Copy the spreadsheet ID from your Google Sheet URL:

   `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`

4. Paste that ID into `SPREADSHEET_ID` near the top of the script.
5. Save, then deploy it as a web app:
   - Execute as: `Me`
   - Who has access: `Anyone`
6. Copy the web app `/exec` URL.

## Map Configuration

Edit `sheets_config.js`:

```js
window.providerSheetsConfig = {
  enabled: true,
  appsScriptUrl: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
};
```

Once enabled, the map will:

- Load only approved provider/category rows from the Sheet.
- Send Add Provider/Add Category submissions into the pending Sheet tabs.
- Send provider edit/deletion requests into the pending provider Sheet.
- Write the logged-in user into `submitted_by` for each new request.
- Geocode approved provider rows that do not have usable coordinates.
- Keep pending and rejected requests out of the public map.
- If `authEnabled` is true, require a valid `User Logins` session before loading the map.
