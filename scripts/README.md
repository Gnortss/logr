# Scripts

## `subset-fonts.mjs`

Subsets `public/fonts/*.ttf` to a minimal Latin + symbols glyph set used by the
e-ink dashboard renderer. Run after replacing any font file:

```
node scripts/subset-fonts.mjs
```

Reduces the bundle by ~700 KB (full Inter v4 + JetBrains Mono Bold totals ~1.1 MB;
subsets total under 400 KB). Required to keep the Cloudflare Workers bundle under
the free-tier 1 MB compressed limit.
