# Stardew Valley Color Palette Reference

> Sampled directly from Stardew Valley using Digital Color Meter (sRGB).
> Use these exact values for PixelLab asset generation to maintain visual consistency.

---

## Color Philosophy

**Warm-dominant palette** with cool accents. Shadows and outlines use cooler, desaturated tones (deep teals, dark browns, muted purples). Highlights push toward saturated warm yellows and oranges. Nature elements use a limited but punchy green range — never neon, always grounded by dark teal/forest bases.

- **Lighting:** Warm golden light across all surfaces
- **Shadows:** Cool-shifted (teal, dark brown, muted blue) — never pure black
- **Outlines:** Darkest value of each element's hue, not a universal outline color
- **Highlights:** Desaturated warm whites and pale yellows

---

## Terrain

### Grass
| Role | RGB |
|------|-----|
| Dry/highlight | `245, 219, 154` |
| Mid green | `112, 199, 37` |
| Deep green | `50, 133, 48` |

### Dirt
| Role | RGB |
|------|-----|
| Shadow | `225, 157, 29` |
| Mid tone | `229, 165, 30` |
| Base | `235, 171, 34` |
| Warm mid | `239, 175, 36` |
| Highlight | `247, 179, 39` |

### Rocky Walking Path
| Role | RGB |
|------|-----|
| Shadow | `100, 74, 67` |
| Mid | `162, 138, 98` |
| Highlight | `195, 171, 120` |

---

## Water

### Sea
| Role | RGB |
|------|-----|
| Deep | `35, 96, 135` |
| Mid-deep | `38, 109, 156` |
| Mid shadow | `51, 135, 194` |
| Mid | `59, 150, 193` |
| Surface | `70, 157, 200` |
| Foam mid | `143, 167, 183` |
| Foam highlight | `194, 195, 197` |

---

## Vegetation

### Bush
| Role | RGB |
|------|-----|
| Deep shadow | `4, 43, 55` |
| Dark | `9, 100, 79` |
| Mid | `13, 154, 80` |
| Bright | `17, 215, 86` |
| Highlight | `150, 255, 130` |

### Tree (Green)
| Role | RGB |
|------|-----|
| Deep shadow | `12, 48, 42` |
| Dark | `17, 69, 52` |
| Bright | `54, 198, 66` |
| Highlight | `122, 255, 102` |

### Tree Trunk (Brown/Orange)
| Role | RGB |
|------|-----|
| Deep shadow | `57, 43, 35` |
| Dark | `84, 54, 0` |
| Mid | `108, 66, 2` |
| Warm | `149, 89, 0` |
| Highlight | `193, 132, 0` |

### Pink Tree (Foliage)
| Role | RGB |
|------|-----|
| Deep shadow | `49, 31, 68` |
| Dark accent | `73, 27, 29` |
| Purple mid | `114, 50, 140` |
| Pink | `246, 134, 229` |
| Light pink | `255, 191, 250` |
| Highlight | `255, 255, 255` |

### Pink Tree Trunk
| Role | RGB |
|------|-----|
| Deep shadow | `73, 27, 29` |
| Dark | `100, 53, 55` |
| Mid brown | `143, 68, 42` |
| Orange | `215, 122, 26` |
| Warm | `246, 140, 33` |
| Highlight | `255, 180, 68` |

---

## Rocks & Walls

### Rock (Natural)
| Role | RGB |
|------|-----|
| Deep shadow | `71, 61, 64` |
| Dark | `88, 71, 78` |
| Mid | `116, 97, 97` |
| Light | `147, 121, 102` |
| Highlight | `184, 162, 132` |

### Rock Wall (Structure)
| Role | RGB |
|------|-----|
| Deep shadow | `24, 16, 2` |
| Dark | `64, 42, 6` |
| Mid-dark | `89, 73, 9` |
| Mid | `122, 93, 12` |
| Warm | `198, 145, 18` |
| Highlight | `243, 215, 33` |

---

## Buildings

### House Walls
| Role | RGB |
|------|-----|
| Base | `241, 190, 148` |
| Highlight | `255, 255, 203` |

### House Base Wall (Stone)
| Role | RGB |
|------|-----|
| Deep shadow | `44, 32, 26` |
| Dark | `95, 81, 60` |
| Mid | `132, 115, 84` |
| Highlight | `169, 154, 108` |

### House Pillars (Wood)
| Role | RGB |
|------|-----|
| Deep shadow | `88, 42, 45` |
| Dark | `120, 41, 41` |
| Mid | `124, 58, 39` |
| Warm | `146, 65, 43` |
| Highlight | `197, 99, 46` |

### House Door
| Role | RGB |
|------|-----|
| Deep shadow | `44, 32, 26` |
| Dark | `88, 42, 45` |
| Dark mid | `120, 41, 41` |
| Mid | `124, 58, 39` |
| Warm | `176, 75, 52` |
| Highlight | `221, 111, 64` |

### Roof
| Role | RGB |
|------|-----|
| Deep shadow | `71, 3, 3` |
| Dark | `120, 41, 41` |
| Mid | `176, 75, 52` |
| Highlight | `221, 111, 64` |

---

## Style Rules for Asset Generation

1. **Shadows are cool-shifted** — add blue/teal to darks, never use pure black or grey
2. **Highlights are warm** — push toward golden yellow, pale cream
3. **Each element uses 3-6 colors** — limited palette per object, not gradients
4. **Outlines match the element** — darkest shade of the object's own hue
5. **Saturation peaks in midtones** — shadows and highlights are more muted
6. **Nature greens are warm-leaning** — yellow-greens, not blue-greens
7. **Wood/brown always has orange undertone** — never grey-brown
8. **Water uses blue-teal** — distinct from the warm land palette, creating natural contrast
