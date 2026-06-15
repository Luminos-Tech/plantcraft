/**
 * App version — update this after each fix or feature change.
 * Format: major.minor.patch
 */
export const APP_VERSION = '1.6.4'

/**
 * Changelog (latest first):
 * 1.6.4 - Backfill neighbor map plant images from owned plant records and
 *         refresh same-day neighbor cache when cached nodes are missing images
 * 1.6.3 - Lower AR effect/aura placement and make avatar capture update
 *         locally immediately while Firebase sync runs in the background
 * 1.6.2 - Keep neighbor map popups inside the map and restore plant avatars
 *         on neighbor markers when shared images are available
 * 1.6.1 - Fix add-plant camera capture sizing, prioritize AR scan overlays,
 *         make avatar capture update immediately, auto-public QR sharing,
 *         and show account-style neighbor names with plant avatar popups
 * 1.6.0 - Add plant-group water cycles with wilt alerts, daily cached
 *         neighbor map rotation, and AR camera avatar capture to Firebase
 *         Storage/user profile
 * 1.5.2 - Audit AR preset placement, friend sharing, and rescue missions:
 *         remove hidden AR locking, republish public slot changes, and prevent
 *         rescue checklist cooldown deadlocks
 * 1.5.1 - Apply preset decoration slots to friend sharing/public sync payloads
 *         and normalize older shared items into the new slot system
 * 1.5.0 - Change AR decoration placement to preset slots based on the detected
 *         plant box, replacing free tap-based x/y positioning
 * 1.4.9 - Refresh global effects with smoother glass surfaces, modern hover
 *         states, animated map markers, reward shine, and ambient motion
 * 1.4.8 - Rework Plant rescue into guided care missions that clear disease
 *         and pay rewards only after users complete the rescue checklist
 * 1.4.7 - Remove AR lock frame controls, add camera plant picker back button,
 *         and remove the garden map scan control
 * 1.4.6 - Clean up garden map controls, add per-plant settings,
 *         and support editing or deleting plants from each card
 * 1.4.5 - Redesign AR scan result modal with stable mobile layout,
 *         clearer diagnosis states, and fixed action area
 * 1.4.4 - Hide AR tracking box after plant detection so effects render cleanly
 * 1.4.3 - Tighten AR placement: hide effects until plant tracking,
 *         add green tracking feedback, pixel VFX, and collapsible AR tools
 * 1.4.2 - Fix friend QR scan hanging on Loading by surfacing Firebase
 *         read errors and adding a shared-plant loading timeout
 * 1.4.1 - Add plant descriptions, save each owned plant to Firebase,
 *         and include descriptions in public QR friend sync
 * 1.4.0 - Add Mission board: daily care contracts, emergency plant rescue,
 *         timed progress, claimable coin rewards, and bottom-nav Mission entry
 * 1.3.3 - Fix mobile shop overflow: constrain page grid/container sizing,
 *         keep filter scrolling local, and resize item cards for narrow screens
 * 1.3.2 - Fix friend sharing: direct share links, reliable public item sync,
 *         existing decoration publishing, scan-friend loading state
 * 1.3.1 - Improve AR tracking responsiveness: lighter camera input, faster
 *         detection interval, fewer prediction candidates, adaptive smoothing
 * 1.3.0 - Rebuild AR decoration mode with a stable locked plant frame, screen-space
 *         canvas mapping, manual frame controls, fit-to-plant placement, and cleaner
 *         pixel-art item rendering to prevent jittery decorations
 * 1.2.1 - Fix QR scanner: direct stream attach, explicit video.play(), pre-load jsQR,
 *         attempt both normal & inverted QR, faster scan interval (250ms)
 * 1.2.0 - Add delete mode: 🗑️ button in AR toolbar to tap-remove placed items
 * 1.1.0 - Improve detection: mobilenet_v2 model, lower threshold (0.15), 18 object classes,
 *         anti-flicker (8-frame persistence), better Gemini prompt with thinking enabled,
 *         higher JPEG capture quality (92%), 30s timeout
 * 1.0.1 - Fix ScanResultModal props mismatch (open/onOpenChange), fix .env.local quote
 * 1.0.0 - Initial release
 */
