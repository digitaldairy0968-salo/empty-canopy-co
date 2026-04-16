

# Milk Entry Keyboard Problem Fix

## Problem
Jab phone pe input field pe click karte ho (code, milk qty, fat etc.), to virtual keyboard bahut bada aata hai aur form content dikh nahi pata.

## Solutions (3 changes)

### 1. Viewport Meta Tag Update
`index.html` mein `interactive-widget=resizes-visual` add karunga. Isse keyboard open hone pe browser viewport properly resize hoga aur content scroll ho sakta hai instead of being pushed off screen.

### 2. Auto-scroll focused input into view
MilkEntry.tsx mein jab koi input focus ho, `scrollIntoView({ block: 'center' })` call karunga with a small delay (300ms for keyboard to open). Isse focused field hamesha visible rahega keyboard ke upar.

### 3. Compact the entry form further
- Input heights reduce (`h-10` instead of `h-12`)
- Labels and spacing tighter
- Entry section ko minimal vertical space use karne do taki keyboard ke saath bhi form visible rahe

## Technical Details

**Files to edit:**
- `index.html` — viewport meta tag mein `interactive-widget=resizes-visual` add
- `src/pages/MilkEntry.tsx` — `onFocus` handler add on inputs for auto-scroll, reduce input sizing
- `src/components/ui/input.tsx` — optional: add a `compact` variant with smaller height

