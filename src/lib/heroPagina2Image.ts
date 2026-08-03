import { getImage } from "astro:assets";
import criancasHero from "../../public/imagens/campanha2/hero.png";

export async function getHeroPagina2Image() {
  const [hero_sm, hero_md, hero_lg, hero_xl, hero_2xl, hero_4k] = await Promise.all([
    getImage({ src: criancasHero, format: "png", width: 800, quality: 100 }),
    getImage({ src: criancasHero, format: "png", width: 1200, quality: 100 }),
    getImage({ src: criancasHero, format: "png", width: 1800, quality: 100 }),
    getImage({ src: criancasHero, format: "png", width: 2400, quality: 100 }),
    getImage({ src: criancasHero, format: "png", width: 3200, quality: 100 }),
    getImage({ src: criancasHero, format: "png", width: 4800, quality: 100 }),
  ]);

  const heroSrcset = `
    ${hero_sm.src} 800w,
    ${hero_md.src} 1200w,
    ${hero_lg.src} 1800w,
    ${hero_xl.src} 2400w,
    ${hero_2xl.src} 3200w,
    ${hero_4k.src} 4800w
  `;
  const heroSizes = "(max-width: 768px) 95vw, 55vw";

  return { heroMdSrc: hero_md.src, heroSrcset, heroSizes };
}
