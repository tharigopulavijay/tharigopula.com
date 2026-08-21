# Build brief — XYZ Jewellery, five experience levels

Paste this whole document into Lovable as your first message.

---

## What we are building and why

We are a technology studio. We sell websites at five levels of richness, and we
need a way to show a business owner what the difference actually is — not as a
feature list, but as something they can see.

So: **one fictional jewellery brand, built five separate times.** Same company,
same products, same photographs. Only the depth of the experience changes.

A visitor should be able to open level 1 and level 5 side by side and instantly
understand what more money buys.

**The brand is called `XYZ Jewellery`.** It is deliberately a placeholder. Do not
invent a different name, and do not use or reference any real jewellery company,
their wording, their layouts or their imagery.

---

## Technology — please follow exactly

This is going to be ported into an existing production site, so the stack has to
match. Please build with:

- **React 19** with **TypeScript** (`.tsx` files, typed props)
- **Tailwind CSS v4** for all styling
- **Vite** as the build tool
- **React Router** for the five routes
- **Plain Tailwind classes only.** Please do not pull in a component library,
  a UI kit, an animation library, or an icon package. Inline SVG for icons is
  perfect. This keeps the code portable.
- Functional components with hooks. No class components.
- No backend, no database, no authentication. All data can be plain TypeScript
  arrays in a `src/data/` file.

Please keep each page **self-contained in its own file** so the five can be
lifted out independently.

Suggested structure:

```
src/
  data/products.ts        <- shared catalogue, used by all five
  pages/Essential.tsx
  pages/Dynamic.tsx
  pages/Interactive.tsx
  pages/Cinematic.tsx
  pages/Immersive.tsx
  components/…            <- anything shared
```

---

## Images

Real photographs are being produced separately. Please reference them at these
exact paths so the real files can be dropped in later:

| Path | What it is | Shape |
|---|---|---|
| `/images/xyz/hero-necklace.jpg` | Ornate necklace on silk, space at right for text | landscape |
| `/images/xyz/ring.jpg` | Solitaire ring, three-quarter angle | square |
| `/images/xyz/earrings.jpg` | Chandelier jhumka earrings | square |
| `/images/xyz/bangles.jpg` | Three stacked engraved bangles | square |
| `/images/xyz/model.jpg` | Necklace worn, neck and collarbone crop | portrait |
| `/images/xyz/craft.jpg` | Goldsmith's hands setting a stone | landscape |
| `/images/xyz/showroom.jpg` | Showroom interior, no people | landscape |
| `/images/xyz/make-1.jpg` … `make-4.jpg` | One ring being made, four stages | landscape |

Until those exist, use a neutral placeholder block of the right aspect ratio —
please do not use an external placeholder service or hotlink any image.

Write real, descriptive `alt` text on every image.

---

## The five pages

The catalogue is shared. Roughly a dozen pieces across **Rings, Necklaces,
Earrings, Bangles**, each with: name, category, metal (yellow / white / rose
gold), weight in grams, stone details, and a price in Indian rupees formatted
like `₹1,45,000`.

The point of this exercise is that the pages must feel **clearly, obviously
different from each other**. If someone flicks between them and cannot tell
which is which, the whole thing has failed.

### 1. Essential — `/essential`

The family jeweller who simply needs to exist online properly.

Static, calm, quick. About the house, the four collections as cards, a short
craftsmanship note, showroom address and hours, an enquiry form, WhatsApp
button. No catalogue browsing, no filtering, no cart.

It should look **credible and finished**, not cheap. This tier is genuinely the
right answer for many businesses and must not be made to look like a failure.

### 2. Dynamic — `/dynamic`

Now the website holds data and does work.

A real catalogue: browse all pieces, filter by category and by metal, sort by
price. Every piece has its own detail view with the full specification and an
enquiry button. Add a simple wishlist held in component state.

The felt difference from Essential: **there is stock in here, and it responds.**

### 3. Interactive — `/interactive`

Everything Dynamic has, plus tools that help someone decide.

- **Compare** — pick two or three pieces, see specifications side by side
- **Ring size guide** — enter a measurement, get the size
- **Live gold rate** — a rate control at the top; when it changes, every gold
  price on the page recalculates from the weight. Please make this genuinely
  reactive, it is the most convincing detail on the page.
- **Try it on** — see the dedicated section below. This is the centrepiece.

### 4. Cinematic — `/cinematic`

A story, told by scrolling.

One ring, from raw gold to finished piece, using `make-1.jpg` through
`make-4.jpg`. Full-viewport scenes that pin while text changes over them,
scroll-linked transitions, generous type, deliberate pacing. Use the
IntersectionObserver API and CSS transforms — please do not add a scroll
library.

It should feel like a film. Slower, quieter, more confident than the others.
Less information on screen, more atmosphere.

### 5. Immersive — `/immersive`

**Please build the page and its controls, but leave the 3D viewer itself as a
clearly marked empty container.** We are wiring the actual WebGL ourselves with
Three.js on our side.

What we need from you is the surrounding experience: a large stage area with
`id="viewer-stage"` reserved for the canvas, plus the control panel around it —
metal switcher (yellow / white / rose gold), stone size selector, a zoom
control, a reset-view button, and a specification panel that updates with the
selections. Style it like a premium product configurator.

---

## The try-on feature — the most important part

On the **Interactive** page. The problem it solves: someone will not buy a
necklace online because they cannot tell how it will look on them.

Please build the **photo upload** version, which works reliably on every device:

1. The visitor uploads a photo of themselves, or takes one with their camera —
   `<input type="file" accept="image/*" capture="user">` handles both.
2. The photo displays on a canvas or as a positioned layer.
3. They pick a piece from the catalogue and it appears as a draggable overlay.
4. They can **drag to position, pinch or slider to resize, and rotate** it.
5. An opacity or blend control helps it sit naturally on the photo.
6. A reset button, and a download button that saves the composed image.

Everything stays in the browser. **Nothing is uploaded to a server** — please
put a short, plainly worded note on screen saying exactly that, because people
are rightly cautious about their photographs.

Make it work with touch as well as mouse.

Please do **not** attempt live camera tracking with face-landmark detection. We
will add that ourselves afterwards. The upload version always works, which
matters more here.

---

## Things to avoid

- Any real jewellery brand's name, copy, layout or images
- Component libraries, icon packages, animation libraries, scroll libraries
- Fake reviews, fake customer counts, fake awards, invented testimonials
- Faces in the photography, above the chin
- A cart or checkout — every piece leads to an **enquiry**, which is how
  jewellery is actually sold at this value
- Lorem ipsum. Please write real sentences.

---

## Design

This is yours — you are better at it than the brief would be. A few constraints
only:

- Warm and restrained. Ivory, cream, deep charcoal, gold as an accent.
- Elegant serif headings, clean sans-serif body.
- Generous whitespace. Jewellery photography needs room around it.
- Mobile-first. Most visitors will be on a phone.
- Every page must be keyboard navigable with sensible focus states.

Take the five levels as a ladder and let each one feel a step richer than the
last.

---

## What to hand back

A working project with all five routes, the shared catalogue, the try-on tool,
and the `/immersive` page with its reserved viewer container. Clean, readable,
commented where a decision is not obvious.
