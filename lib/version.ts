/**
 * App version — update this after each fix or feature change.
 * Format: major.minor.patch
 */
export const APP_VERSION = '1.3.2'

/**
 * Changelog (latest first):
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
