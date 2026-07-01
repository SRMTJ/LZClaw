# 2026-07-01 Client Sidebar Banner

## Change Summary

lobsterai-server adds a public client banner endpoint for the desktop sidebar invitation ad.

## Endpoint Details

`GET /api/client-banners/active?placement=desktop_sidebar`

Auth: public. If the client has a Bearer token, send it so the server can suppress the invitation banner for users who have already completed the 3-invite historical threshold.

Response:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "placement": "desktop_sidebar",
    "activityDescription": "邀请好友赚积分",
    "weight": 1,
    "status": 1,
    "linkUrl": "https://lobsterai.youdao.com/portal#/invitation",
    "imageUrl": "https://nos.example.com/banner.png",
    "imageWidth": 800,
    "imageHeight": 250,
    "updatedAt": "2026-07-01T10:00:00"
  }
}
```

`data` is `null` when no eligible banner should be shown.

## Frontend Action Items

- Fetch the active banner for `desktop_sidebar`.
- Display it above the sidebar account/settings row.
- Store close state by user, banner id, and `updatedAt`.
- First close hides for 7 days; second close hides that banner version permanently.

## Auth Requirements

Anonymous calls are allowed. Logged-in calls should include the current Bearer token.

## Notes & Caveats

The sidebar slot should render at `16:5` with adaptive width and proportional height. The recommended image source size is `800x250`; SVG is not supported for this rollout.
