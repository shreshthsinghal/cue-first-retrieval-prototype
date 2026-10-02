import type { Photo } from './types'

// ── The synthetic evaluation library ─────────────────────────────────────────
// A 40-item camera roll for one synthetic persona, structured the way the
// research says real libraries behave: life-event clusters, a few chat-origin
// screenshots, and two deleted photos kept as existence records (the 154
// deleted-photo items in the corpus stay adjacent, never sold as a search
// problem). Every benchmark case resolves against this manifest, so the
// manifest is the retrieval ground truth. All photos are generated for
// evaluation; no real person's library is simulated.

const P = (p: Photo): Photo => p

export const PHOTOS: Photo[] = [
  // ── Birthday at the lake · June 2025 (the persona's birthday month) ──────
  P({
    id: 'IMG_20250611_1843', src: '/photos/b1.jpg', date: '2025-06-11', album: 'Birthday at the lake',
    events: ['birthday'], tags: ['lake', 'water', 'golden-hour', 'dress', 'portrait', 'boating'],
    colors: ['red'], setting: 'water', people: 1, timeOfDay: 'sunset', origin: 'camera',
    width: 768, height: 1344,
  }),
  P({
    id: 'IMG_20250611_2030', src: '/photos/b2.jpg', date: '2025-06-11', album: 'Birthday at the lake',
    events: ['birthday'], tags: ['cake', 'candles', 'table', 'decorations', 'fairy-lights', 'lake', 'water'],
    colors: ['white'], setting: 'water', people: 0, timeOfDay: 'night', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20250611_1645', src: '/photos/b3.jpg', date: '2025-06-11', album: 'Birthday at the lake',
    events: ['birthday'], tags: ['lake', 'water', 'group', 'friends', 'laughing'],
    colors: ['blue', 'white'], setting: 'water', people: 5, timeOfDay: 'day', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20250611_1902', src: '/photos/b4.jpg', date: '2025-06-11', album: 'Birthday at the lake',
    events: ['birthday'], tags: ['sunset', 'lake', 'water', 'silhouettes'],
    colors: ['orange'], setting: 'water', people: 2, timeOfDay: 'sunset', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20250611_1758', src: '/photos/b5.jpg', date: '2025-06-11', album: 'Birthday at the lake',
    events: ['birthday'], tags: ['balloons', 'fairy-lights', 'decorations', 'deck', 'lake'],
    colors: ['pink'], setting: 'outdoor', people: 0, timeOfDay: 'sunset', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20250612_1017', src: '/photos/b6.jpg', date: '2025-06-12', album: 'Birthday at the lake',
    events: ['birthday'], tags: ['boating', 'lake', 'water', 'dress', 'portrait'],
    colors: ['red'], setting: 'water', people: 1, timeOfDay: 'day', origin: 'camera',
    width: 768, height: 1344,
  }),
  // Deleted ghost: the P1-style target. Existed, then removed in a cleanup.
  P({
    id: 'IMG_20250611_1930', src: '/photos/g1.jpg', date: '2025-06-11', album: 'Birthday at the lake',
    events: ['birthday'], tags: ['cake', 'candles', 'blowing', 'lake', 'water'],
    colors: ['yellow'], setting: 'water', people: 2, timeOfDay: 'sunset', origin: 'camera',
    width: 1344, height: 768,
    deleted: { on: '2026-03-14', note: 'Removed during a free-up-storage cleanup on 14 Mar 2026.' },
  }),

  // ── Anjali's wedding · Goa · December 2024 ────────────────────────────────
  P({
    id: 'IMG_20241215_1102', src: '/photos/w1.jpg', date: '2024-12-15', album: "Anjali's wedding · Goa",
    events: ['wedding'], tags: ['wedding', 'mandap', 'beach', 'sea', 'flowers'],
    colors: ['white', 'red'], setting: 'beach', people: 20, timeOfDay: 'day', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20241215_1754', src: '/photos/w2.jpg', date: '2024-12-15', album: "Anjali's wedding · Goa",
    events: ['wedding'], tags: ['wedding', 'couple', 'beach', 'sea', 'sunset'],
    colors: ['red'], setting: 'beach', people: 2, timeOfDay: 'sunset', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20241214_1415', src: '/photos/w3.jpg', date: '2024-12-14', album: "Anjali's wedding · Goa",
    events: ['wedding'], tags: ['mehndi', 'henna', 'hands', 'wedding'],
    colors: ['red', 'orange'], setting: 'indoor', people: 1, timeOfDay: 'day', origin: 'camera',
    width: 768, height: 1344,
  }),
  P({
    id: 'IMG_20241215_2105', src: '/photos/w4.jpg', date: '2024-12-15', album: "Anjali's wedding · Goa",
    events: ['wedding'], tags: ['wedding', 'dinner', 'table', 'fairy-lights', 'food'],
    colors: ['orange'], setting: 'outdoor', people: 8, timeOfDay: 'night', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20241215_2240', src: '/photos/w5.jpg', date: '2024-12-15', album: "Anjali's wedding · Goa",
    events: ['wedding'], tags: ['fireworks', 'wedding', 'beach', 'night'],
    colors: ['orange'], setting: 'beach', people: 15, timeOfDay: 'night', origin: 'camera',
    width: 1344, height: 768,
  }),

  // ── Kedarkantha trek · October 2025 ───────────────────────────────────────
  P({
    id: 'IMG_20251019_0934', src: '/photos/t1.jpg', date: '2025-10-19', album: 'Kedarkantha trek',
    events: ['trek'], tags: ['trail', 'forest', 'pine', 'hiking'],
    colors: ['green'], setting: 'mountains', people: 3, timeOfDay: 'day', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20251021_1230', src: '/photos/t2.jpg', date: '2025-10-21', album: 'Kedarkantha trek',
    events: ['trek'], tags: ['summit', 'snow', 'group', 'friends'],
    colors: ['white', 'blue'], setting: 'mountains', people: 4, timeOfDay: 'day', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20251020_2048', src: '/photos/t3.jpg', date: '2025-10-20', album: 'Kedarkantha trek',
    events: ['trek'], tags: ['tents', 'campsite', 'stars', 'night'],
    colors: ['green'], setting: 'mountains', people: 2, timeOfDay: 'night', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20251019_1436', src: '/photos/t4.jpg', date: '2025-10-19', album: 'Kedarkantha trek',
    events: ['trek'], tags: ['river', 'water', 'stones', 'forest'],
    colors: ['blue', 'green'], setting: 'mountains', people: 1, timeOfDay: 'day', origin: 'camera',
    width: 1344, height: 768,
  }),

  // ── Graduation · May 2023 ─────────────────────────────────────────────────
  P({
    id: 'IMG_20230516_1032', src: '/photos/gr1.jpg', date: '2023-05-16', album: 'Graduation',
    events: ['graduation'], tags: ['graduation', 'cap', 'gown', 'portrait', 'campus'],
    colors: ['black'], setting: 'campus', people: 1, timeOfDay: 'day', origin: 'camera',
    width: 768, height: 1344,
  }),
  P({
    id: 'IMG_20230516_1158', src: '/photos/gr2.jpg', date: '2023-05-16', album: 'Graduation',
    events: ['graduation'], tags: ['graduation', 'cap', 'gown', 'group', 'campus'],
    colors: ['black'], setting: 'campus', people: 6, timeOfDay: 'day', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20230516_1219', src: '/photos/gr3.jpg', date: '2023-05-16', album: 'Graduation',
    events: ['graduation'], tags: ['graduation', 'parents', 'family', 'campus'],
    colors: ['white'], setting: 'campus', people: 3, timeOfDay: 'day', origin: 'camera',
    width: 1344, height: 768,
  }),

  // ── Gokarna weekend · February 2026 ───────────────────────────────────────
  P({
    id: 'IMG_20260214_1046', src: '/photos/be1.jpg', date: '2026-02-14', album: 'Gokarna weekend',
    events: ['beach-trip'], tags: ['beach', 'volleyball', 'sea', 'friends'],
    colors: ['blue'], setting: 'beach', people: 4, timeOfDay: 'day', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20260214_1807', src: '/photos/be2.jpg', date: '2026-02-14', album: 'Gokarna weekend',
    events: ['beach-trip'], tags: ['beach', 'sea', 'selfie', 'friends', 'sunset'],
    colors: ['orange'], setting: 'beach', people: 4, timeOfDay: 'sunset', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20260215_0952', src: '/photos/be3.jpg', date: '2026-02-15', album: 'Gokarna weekend',
    events: ['beach-trip'], tags: ['beach', 'waves', 'sea', 'water'],
    colors: ['blue'], setting: 'beach', people: 1, timeOfDay: 'day', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20260214_2059', src: '/photos/be4.jpg', date: '2026-02-14', album: 'Gokarna weekend',
    events: ['beach-trip'], tags: ['beach', 'shack', 'dinner', 'fairy-lights', 'night', 'food'],
    colors: ['orange'], setting: 'beach', people: 6, timeOfDay: 'night', origin: 'camera',
    width: 1344, height: 768,
  }),

  // ── Home · spread 2024 to 2026 ────────────────────────────────────────────
  P({
    id: 'IMG_20260304_2055', src: '/photos/h1.jpg', date: '2026-03-04', album: 'Home',
    events: ['everyday'], tags: ['dinner', 'family', 'food', 'table', 'festival'],
    colors: ['red'], setting: 'indoor', people: 5, timeOfDay: 'night', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20240210_0844', src: '/photos/h2.jpg', date: '2024-02-10', album: 'Home',
    events: ['everyday'], tags: ['kitchen', 'cooking', 'home'],
    colors: ['white'], setting: 'home', people: 1, timeOfDay: 'day', origin: 'camera',
    width: 768, height: 1344,
  }),
  P({
    id: 'IMG_20241109_1702', src: '/photos/h3.jpg', date: '2024-11-09', album: 'Home',
    events: ['everyday'], tags: ['dog', 'sofa', 'home'],
    colors: ['brown'], setting: 'home', people: 1, timeOfDay: 'day', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20250712_1657', src: '/photos/h4.jpg', date: '2025-07-12', album: 'Home',
    events: ['everyday'], tags: ['chai', 'rain', 'window', 'monsoon', 'home'],
    colors: ['grey'], setting: 'home', people: 1, timeOfDay: 'day', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20260111_2051', src: '/photos/h5.jpg', date: '2026-01-11', album: 'Home',
    events: ['birthday'], tags: ['birthday', 'cake', 'candles', 'family', 'home'],
    colors: ['pink'], setting: 'indoor', people: 4, timeOfDay: 'night', origin: 'camera',
    width: 1344, height: 768,
  }),

  // ── Mumbai weekend · August 2025 ──────────────────────────────────────────
  P({
    id: 'IMG_20250823_2104', src: '/photos/c1.jpg', date: '2025-08-23', album: 'Mumbai weekend',
    events: ['city-trip'], tags: ['concert', 'crowd', 'stage', 'fairy-lights', 'music'],
    colors: ['purple'], setting: 'city', people: 50, timeOfDay: 'night', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20250823_1945', src: '/photos/c2.jpg', date: '2025-08-23', album: 'Mumbai weekend',
    events: ['city-trip'], tags: ['skyline', 'night', 'city', 'fairy-lights'],
    colors: ['orange'], setting: 'city', people: 0, timeOfDay: 'night', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20250824_1248', src: '/photos/c3.jpg', date: '2025-08-24', album: 'Mumbai weekend',
    events: ['city-trip'], tags: ['street-food', 'stall', 'city', 'food'],
    colors: ['red'], setting: 'city', people: 2, timeOfDay: 'day', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20250824_0934', src: '/photos/c4.jpg', date: '2025-08-24', album: 'Mumbai weekend',
    events: ['city-trip'], tags: ['metro', 'platform', 'city'],
    colors: ['grey'], setting: 'city', people: 10, timeOfDay: 'day', origin: 'camera',
    width: 1344, height: 768,
  }),

  // ── Everyday · spread ─────────────────────────────────────────────────────
  P({
    id: 'IMG_20260118_0752', src: '/photos/m1.jpg', date: '2026-01-18', album: 'Everyday',
    events: ['everyday'], tags: ['park', 'fog', 'morning', 'walk'],
    colors: ['green'], setting: 'outdoor', people: 2, timeOfDay: 'day', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20240503_1608', src: '/photos/m2.jpg', date: '2024-05-03', album: 'Everyday',
    events: ['everyday'], tags: ['coffee', 'cafe', 'cup'],
    colors: ['brown'], setting: 'indoor', people: 1, timeOfDay: 'day', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20240915_0658', src: '/photos/m3.jpg', date: '2024-09-15', album: 'Everyday',
    events: ['everyday'], tags: ['cycling', 'trail', 'morning'],
    colors: ['black'], setting: 'outdoor', people: 1, timeOfDay: 'day', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'IMG_20231227_2137', src: '/photos/m4.jpg', date: '2023-12-27', album: 'Everyday',
    events: ['everyday'], tags: ['books', 'shelf', 'room'],
    colors: ['brown'], setting: 'indoor', people: 0, timeOfDay: 'day', origin: 'camera',
    width: 1344, height: 768,
  }),

  // ── Study + chat-origin items (the second-brain realism, G1) ──────────────
  P({
    id: 'IMG_20250908_1425', src: '/photos/s3.jpg', date: '2025-09-08', album: 'Everyday',
    events: ['everyday'], tags: ['whiteboard', 'study', 'exam', 'notes'],
    colors: ['white'], setting: 'indoor', people: 1, timeOfDay: 'day', origin: 'camera',
    width: 1344, height: 768,
  }),
  P({
    id: 'SCREENSHOT_20250620_2214', src: '/photos/s1.png', date: '2025-06-20', album: 'Screenshots',
    events: ['everyday'], tags: ['meme', 'exam', 'chat', 'forwarded'],
    colors: ['white'], setting: 'indoor', people: 0, timeOfDay: 'day', origin: 'screenshot',
    width: 640, height: 1280,
  }),
  P({
    id: 'SCREENSHOT_20260119_0912', src: '/photos/s2.png', date: '2026-01-19', album: 'Screenshots',
    events: ['everyday'], tags: ['ticket', 'booking', 'train', 'confirmation'],
    colors: ['white'], setting: 'indoor', people: 0, timeOfDay: 'day', origin: 'screenshot',
    width: 640, height: 1280,
  }),

  // ── Second deleted ghost: family group at the old house ──────────────────
  P({
    id: 'IMG_20240815_1830', src: '/photos/g2.jpg', date: '2024-08-15', album: 'Home',
    events: ['everyday'], tags: ['family', 'group', 'house', 'festival'],
    colors: ['red'], setting: 'home', people: 9, timeOfDay: 'day', origin: 'camera',
    width: 1344, height: 768,
    deleted: { on: '2025-01-06', note: 'Deleted on 6 Jan 2025; the WhatsApp copy is the only one left.' },
  }),
]

export const LIVING_PHOTOS = PHOTOS.filter((p) => !p.deleted)
export const DELETED_PHOTOS = PHOTOS.filter((p) => p.deleted)
export const PHOTO_COUNT = PHOTOS.length

/** The persona's birthday month: the anchor "around my birthday" resolves to it. */
export const BIRTHDAY_MONTH = 6

/** The engine's reference date (kept explicit so runs are reproducible). */
export const REFERENCE_NOW = { year: 2026, month: 10, label: 'October 2026' }

export const ALBUMS = Array.from(new Set(PHOTOS.map((p) => p.album)))
