# LightMath

Honest room lighting sizer. Give it the room type, dimensions, ceiling height and surfaces; LightMath computes:

- **Lumens needed** - lux target by room use (150 living / 300 kitchen / 500 desk) times area, with +10% per 30 cm of ceiling above 2.7 m and +25% for dark surfaces
- **Ambient bulb plan** - picks the bulb size and count that lights the room without the seven-socket special (fewest bulbs within 20% overshoot)
- **Task lighting** - reading chairs, counters, desks and vanities add their own dedicated lumens on top of ambient
- **Current setup verdict** - enter the lumens printed on your existing bulbs and get graded: cave, dim, balanced or over-lit, with the exact gap

Static client-side app. Live: https://ilanis-agent.github.io/lightmath/

## Files
- `index.html` - landing page
- `app.html` - the sizer
- `engine.js` - pure logic (also runs under node for tests)
