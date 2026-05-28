# Tracker drop

- **Run id:** `2026-05-28T18-34-25Z`
- **Created (UTC):** 2026-05-28T18:34:25.166Z
- **New signals added this collect:** 165
- **Retention window (days):** 7
- **Signals kept after prune:** 165 (removed as too old: 0)

## Next

1. Pull this branch in Cursor.
2. Read this file, then `signals.json` for raw rows.
3. Interpret in Chat / Composer using only committed files (see TRACKER-FLOW-END-TO-END.md §4).

## Intel snapshot (from last run)

```json
{
  "retention_days": 7,
  "pillar_signal_counts_this_run": {
    "1": 110,
    "2": 44,
    "3": 11,
    "4": 0,
    "unclassified": 0
  },
  "pillars_touched_this_run": [
    1,
    2,
    3
  ],
  "distinct_pillars_this_run": 3,
  "coverage_report": {
    "competitors": [
      {
        "id": "eliseai",
        "name": "EliseAI",
        "coverage": {
          "pillar_1_configured": true,
          "pillar_2_configured": true,
          "pillar_3_configured": false,
          "pillar_4_in_app": false,
          "missing_hints": [
            "Pillar 3 (third party): set g2_reviews_url, media_url, reviews_url, and/or youtube_comment_video_ids and/or youtube_discovery_queries (+ YOUTUBE_DATA_API_KEY)",
            "Pillar 4 (structural): not collected by this app yet — add LinkedIn/Crunchbase/etc. manually or future integration"
          ]
        }
      },
      {
        "id": "funnel-leasing",
        "name": "Funnel Leasing",
        "coverage": {
          "pillar_1_configured": true,
          "pillar_2_configured": true,
          "pillar_3_configured": true,
          "pillar_4_in_app": false,
          "missing_hints": [
            "Pillar 4 (structural): not collected by this app yet — add LinkedIn/Crunchbase/etc. manually or future integration"
          ]
        }
      },
      {
        "id": "leasehawk",
        "name": "LeaseHawk (ACE)",
        "coverage": {
          "pillar_1_configured": true,
          "pillar_2_configured": true,
          "pillar_3_configured": false,
          "pillar_4_in_app": false,
          "missing_hints": [
            "Pillar 3 (third party): set g2_reviews_url, media_url, reviews_url, and/or youtube_comment_video_ids and/or youtube_discovery_queries (+ YOUTUBE_DATA_API_KEY)",
            "Pillar 4 (structural): not collected by this app yet — add LinkedIn/Crunchbase/etc. manually or future integration"
          ]
        }
      },
      {
        "id": "anyone-home",
        "name": "Anyone Home",
        "coverage": {
          "pillar_1_configured": true,
          "pillar_2_configured": true,
          "pillar_3_configured": false,
          "pillar_4_in_app": false,
          "missing_hints": [
            "Pillar 3 (third party): set g2_reviews_url, media_url, reviews_url, and/or youtube_comment_video_ids and/or youtube_discovery_queries (+ YOUTUBE_DATA_API_KEY)",
            "Pillar 4 (structural): not collected by this app yet — add LinkedIn/Crunchbase/etc. manually or future integration"
          ]
        }
      },
      {
        "id": "jonah-digital",
        "name": "Jonah Digital Agency",
        "coverage": {
          "pillar_1_configured": true,
          "pillar_2_configured": false,
          "pillar_3_configured": false,
          "pillar_4_in_app": false,
          "missing_hints": [
            "Pillar 2 (behavioral): set pricing_url and/or careers_url",
            "Pillar 3 (third party): set g2_reviews_url, media_url, reviews_url, and/or youtube_comment_video_ids and/or youtube_discovery_queries (+ YOUTUBE_DATA_API_KEY)",
            "Pillar 4 (structural): not collected by this app yet — add LinkedIn/Crunchbase/etc. manually or future integration"
          ]
        }
      }
    ],
    "summary": {
      "competitors_weak_p3": [
        "eliseai",
        "leasehawk",
        "anyone-home",
        "jonah-digital"
      ],
      "note": "Strong weekly insights need signals from multiple pillars. Configure P1+P2+P3 per competitor where possible."
    }
  }
}
```
