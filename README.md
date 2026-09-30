# Rabbit Hole

**Fall down a rabbit hole, on purpose.**

Rabbit Hole turns Wikipedia into worlds you can fall into. Every world is built from one article, and every orb in it is a real article it links to. Tap an orb to read it, dive in to land in its world, and keep going for as long as you're curious. Or play the Wikipedia challenge: reach a hidden goal through as few worlds as you can.

## Run it locally

It's a static site with no build step:

```
python -m http.server 5178
```

Then open http://localhost:5178. Add `?intro` to the address to see the intro again.

## Credits

- Articles and pictures from [Wikipedia](https://www.wikipedia.org/), shared under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- 3D intro built with [three.js](https://threejs.org/) (MIT).
- Studio light from [Poly Haven](https://polyhaven.com/) (CC0).
- Sound effects made with [ElevenLabs](https://elevenlabs.io/).
