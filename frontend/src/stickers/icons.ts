// CloudKeeper icons: the worked `camera` from the fun-isometric set, trimmed to what the empty state needs.
import { VIEWS, arc, ellipse, line, onFace, pill, poly, rect, ring, spark } from './fun'
import { clasp, float, glint, press, shackle, slide, sway, toss, tossLag, tossLag2, twinkle } from './motions'
import type { Icon, Layer, Motion, Vec } from './fun'

const LINE = 5
const { tilt: FACE, extrude: EXT } = VIEWS.right

const glow = (parent: string, p: Vec, r: number, m: Motion | ReadonlyArray<Motion>, extra: { ip?: number; op?: number } = {}): Layer => ({
  parent,
  a: p,
  p,
  m,
  ...extra,
  shapes: [{ d: spark(p[0], p[1], r), fill: 'white' }],
})

const SHUTTER = onFace(FACE, [92, -104])
const FLASH = onFace(FACE, [-96, -48])

export const camera: Icon = {
  name: 'camera',
  frames: 180,
  line: LINE,
  extrude: EXT,
  layers: [
    { id: 'cam', a: [0, 100], p: [250, 366], m: { ...sway, k: 0.6 }, shapes: [] },
    { parent: 'cam', tilt: FACE, shapes: [{ d: rect(-64, -126, 128, 50, 14), fill: 'deep', depth: 0.8 }] },
    { parent: 'cam', a: SHUTTER, p: SHUTTER, m: { ...press, k: 0.35 }, tilt: FACE, shapes: [{ d: pill(70, -118, 46, 28), fill: 'hot', depth: 0.6 }] },
    {
      parent: 'cam',
      tilt: FACE,
      shapes: [
        { d: rect(-146, -90, 292, 192, 32), fill: 'deep', depth: 1 },
        { d: rect(-146, -24, 292, 64), fill: 'tint' },
        { d: rect(-124, -66, 52, 30, 8), fill: 'gold', depth: 0.3 },
        { d: ellipse(20, 8, 82), fill: 'white', depth: 0.6 },
        { d: ring(20, 8, 70, 46), fill: 'main', depth: 0.8 },
        { d: ellipse(20, 8, 46), fill: 'deep' },
        { d: arc(20, 8, 30, 200, 260) },
      ],
    },
    glow('cam', FLASH, 28, glint(36, 120)),
  ],
}

const CLOUD = 'M-112 64A54 54 0 0 1 -116 -38A72 72 0 0 1 20 -76A64 64 0 0 1 124 -18A44 44 0 0 1 112 64Z'

// the worked `cloud` from the set: floats, an upload arrow slides up out of it
export const cloud: Icon = {
  name: 'cloud',
  frames: 180,
  line: LINE,
  extrude: EXT,
  layers: [
    { id: 'sky', p: [250, 270], m: float, shapes: [] },
    { parent: 'sky', tilt: FACE, shapes: [{ d: CLOUD, fill: 'white', depth: 1 }] },
    {
      parent: 'sky',
      tilt: FACE,
      m: slide([0, -40], 30, 50, 50),
      shapes: [{ d: poly([[0, -66], [52, -10], [22, -10], [22, 50], [-22, 50], [-22, -10], [-52, -10]], 6), fill: 'ok', depth: 0.8 }],
    },
  ],
}

// the worked `folder` from the set: a photo and a sheet toss out of it
export const folder: Icon = {
  name: 'folder',
  frames: 180,
  line: LINE,
  extrude: EXT,
  layers: [
    { parent: 'body', shapes: [{ d: poly([[-130, -100], [-56, -100], [-34, -76], [130, -76], [130, 92], [-130, 92]], [18, 8, 8, 18, 18, 18]), fill: 'main', depth: 1 }] },
    {
      parent: 'body',
      a: [-108, 50],
      p: [-108, 50],
      m: tossLag2,
      shapes: [{ d: rect(-104, -136, 206, 192, 12), fill: 'white', depth: 0.3 }, { d: line([-78, -118], [8, -118]) }],
    },
    { parent: 'body', a: [-116, 52], p: [-116, 52], m: tossLag, shapes: [{ d: rect(-116, -104, 226, 164, 12), fill: 'ok', depth: 0.3 }] },
    {
      id: 'body',
      a: [-130, 20],
      p: [126, 294],
      tilt: FACE,
      m: toss,
      shapes: [{ d: rect(-130, -46, 260, 138, 18), fill: 'deep', depth: 1 }, { d: pill(-46, -12, 92, 28), fill: 'white', depth: 0.3 }],
    },
  ],
}

const KEYHOLE = ellipse(0, -4, 17) + poly([[-8, 6], [8, 6], [13, 42], [-13, 42]], 3)
const SHACKLE = 'M-74 -40L-74 -122A74 74 0 0 1 74 -122L74 -40L42 -40L42 -122A42 42 0 0 0 -42 -122L-42 -40Z'

// the worked `padlock` from the set: the shackle springs open, the lock slams shut
export const padlock: Icon = {
  name: 'padlock',
  frames: 130,
  line: LINE,
  extrude: EXT,
  layers: [
    { id: 'lock', p: [256, 300], m: clasp, shapes: [] },
    { parent: 'body', a: [-58, -62], p: [-58, -62], m: shackle, shapes: [{ d: SHACKLE, fill: 'grey', depth: 0.7 }] },
    {
      id: 'body',
      parent: 'lock',
      tilt: FACE,
      shapes: [
        { d: rect(-112, -80, 224, 176, 24), fill: 'ok', depth: 1 },
        { d: ellipse(0, 8, 36, 50), fill: 'white', depth: 0.25 },
        { d: KEYHOLE, fill: 'ink', line: false },
      ],
    },
    glow('lock', [-142, -70], 30, twinkle(0, true), { op: 30 }),
    glow('lock', [-142, -70], 30, twinkle(75), { ip: 75 }),
  ],
}