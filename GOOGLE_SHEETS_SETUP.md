# Google Sheets Approval Workflow

This version uses Google Sheets as the review console and source of truth for approved manual additions and provider change requests.

## Workbook

Create a Google Sheet named `Provider Network Submissions and Approvals`.

The Apps Script in `google_apps_script.gs` will create these tabs automatically the first time it runs:

- `Provider Submissions`
- `Category Submissions`

Reviewers approve rows by changing `review_status` to `Approved`. Rows left as `Pending` stay out of the public map. Rows marked `Rejected` are ignored.

Provider rows use `change_action` to decide what happens after approval:

- `Add` publishes a new provider.
- `Edit` updates the matching provider.
- `Delete` hides the matching provider from the public map.

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
- Keep pending and rejected requests out of the public map.
