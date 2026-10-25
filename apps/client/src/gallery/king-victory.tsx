import * as THREE from 'three/webgpu';
import { installBvhRaycasting } from '../scene/bvh';
import { rehearseEffects } from '../scene/effect-rehearsal';
import { createRoot } from 'react-dom/client';
import {
  ActionKind,
  CROWNBREAKER_HOLD,
  KING_REMNANTS,
  DEFAULT_WORLD_SEED,
  buildWilderness,
  buildTestClearing,
  createWildernessTerrain,
} from '@acorn/shared';
import { createGalleryGround } from './gallery';
import { buildClearingScene } from '../scene/clearing';
import { createEncounterLandmarks } from '../scene/encounter-sites';
import { preloadRaiderModels } from '../scene/raider-model';
import { preloadCharacterAnimations } from '../scene/character-animations';
import { RaiderFigure } from '../scene/raider-figure';
import { ImpactBursts } from '../scene/impact-bursts';
import { MoveMemory } from '../scene/character-driver';
import { KingStormEffect } from '../scene/king-storm';
import { KingStorm } from '../hud/KingStorm';
import { WorldBossBar } from '../hud/WorldBossBar';
import { kingStormPhase, CHARGE_TICKS, type KingStormView } from '@acorn/shared';
import { KingVictoryEffect, KING_VICTORY_SECONDS } from '../scene/king-victory';
import { KingVictory } from '../hud/KingVictory';
import { playEarthRumble, playWindupRing } from '../audio/raid-sounds';
import { playKingVictory } from '../audio/king-victory';
import type { RendererSetup } from '../scene/renderer';
import type { DaylightRig } from '../scene/lighting';

/** Inspect or replay the exact runtime effect and HUD without completing a boss fight. */
export async function showKingVictory(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  daylight: DaylightRig,
  params: URLSearchParams,
) {
  const stormMode = params.get('gallery') === 'king-storm';
  installBvhRaycasting();
  await Promise.all([preloadRaiderModels(), preloadCharacterAnimations()]);
  const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED),
    at = CROWNBREAKER_HOLD;
  const y = terrain.heightAt(at.x, at.z);
  const props = buildWilderness(DEFAULT_WORLD_SEED, terrain).props.filter(
    (p) => Math.hypot(p.x - at.x, p.z - at.z) < 70,
  );
  const ground = createGalleryGround(
    props,
    (x, z) => terrain.heightAt(x + at.x, z + at.z),
    150,
    120,
    [],
    at,
  );
  ground.position.set(at.x, 0, at.z);
  scene.add(ground);
  const forest = buildClearingScene(
    { ...buildTestClearing(DEFAULT_WORLD_SEED), props, pickups: [], water: [] },
    terrain,
  );
  const ruins = createEncounterLandmarks(KING_REMNANTS, terrain);
  scene.add(forest.group, ruins.group);
  daylight.sun.position.set(at.x + 28, y + 60, at.z - 20);
  daylight.sun.target.position.set(at.x, y, at.z);
  daylight.sun.target.updateMatrixWorld();
  if (scene.fog instanceof THREE.Fog) {
    scene.fog.near = 45;
    scene.fog.far = 120;
  }
  const bursts = new ImpactBursts();
  scene.add(bursts.group);
  const king = RaiderFigure.create('hollowKing', scene, bursts),
    memory = new MoveMemory();
  const effect = new KingVictoryEffect();
  const stormArt = stormMode ? new KingStormEffect(terrain) : null;
  scene.add(effect.group);
  if (stormArt) scene.add(stormArt.group);
  const reduced = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.05, 180);
  camera.position.set(at.x + 12, y + 6, at.z - 19);
  camera.lookAt(at.x, y + 3, at.z);
  if (stormMode) {
    camera.position.set(at.x + 34, y + 27, at.z - 36);
    camera.lookAt(at.x, y + 1, at.z);
  }
  renderer.setSize(innerWidth, innerHeight, false);
  rehearseEffects([stormArt?.group ?? effect.group, ...(king ? [king.character.group] : [])], () =>
    renderer.render(scene, camera),
  );
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;inset:0;pointer-events:none;';
  document.body.append(holder);
  const root = createRoot(holder);
  const toolbar = document.createElement('div');
  toolbar.style.cssText =
    'position:fixed;top:12px;left:12px;z-index:60;color:#f0e6cf;font:12px system-ui;background:#151d23dd;padding:10px;border:1px solid #9f8f6d66;border-radius:6px;';
  const replay = document.createElement('button');
  replay.textContent = stormMode ? 'Replay the soul storm' : 'Replay the King’s fall';
  toolbar.append(
    replay,
    document.createTextNode(
      stormMode ? ' · warning → storm → recovery' : ' · live effect + actual enchanted blade',
    ),
  );
  document.body.append(toolbar);
  let fixed = params.has('at')
    ? Math.max(0, Math.min(stormMode ? 16 : 11, Number(params.get('at')) || 0))
    : null;
  let started = performance.now(),
    key = 1,
    shown = true,
    stopSound = () => {};
  let stormHud = '';
  let stormSound = false;
  const stormAt = (age: number): KingStormView | null => {
    const phase = kingStormPhase(age * 20);
    return phase
      ? { ...phase, bossId: 1, wave: 1, sheltered: params.has('sheltered'), outside: false }
      : null;
  };
  const showStormHud = (storm: KingStormView | null) => {
    const signature = storm ? `${storm.phase}-${Math.ceil(storm.remainingTicks / 20)}` : 'none';
    if (signature === stormHud) return;
    if (stormSound && storm?.phase === 'storm' && !stormHud.startsWith('storm'))
      playEarthRumble(0.65);
    stormHud = signature;
    root.render(
      storm && !params.has('before') ? (
        <>
          <WorldBossBar boss={{ health: 132, maxHealth: 220, awakening: false }} />
          <KingStorm storm={storm} />
        </>
      ) : null,
    );
  };
  const begin = (sound = false) => {
    started = performance.now();
    stormSound = sound;
    if (sound && stormMode) playWindupRing(0.6);
    const victoryKey = key++;
    shown = true;
    effect.start({ x: at.x, y, z: at.z }, reduced);
    if (stormMode) {
      stormHud = '';
      showStormHud(stormAt(fixed ?? 0));
    } else
      root.render(
        params.has('before') ? (
          <div className="raid-banner raid-banner-victory">
            <p className="raid-banner-title">The Hollow King has fallen</p>
            <p className="raid-banner-detail">Contributors can collect their personal rewards</p>
          </div>
        ) : (
          <KingVictory
            key={victoryKey}
            victory={{ key: victoryKey, startedAt: started - (fixed ?? 0) * 1000 }}
          />
        ),
      );
    stopSound();
    if (sound && !stormMode) stopSound = playKingVictory();
  };
  if (fixed !== null) holder.className = 'king-victory-still';
  replay.onclick = () => {
    fixed = null;
    holder.classList.remove('king-victory-still');
    begin(true);
  };
  begin();
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);
  let frames = 0;
  renderer.setAnimationLoop(() => {
    const age = fixed ?? (performance.now() - started) / 1000;
    if (king) {
      king.character.group.visible = stormMode || age < 1.7;
      king.draw(
        1 / 60,
        { x: at.x, y, z: at.z, yaw: Math.PI },
        {
          move: memory.view(
            stormMode
              ? stormAt(age) && stormAt(age)?.phase !== 'recovery'
                ? ActionKind.Charge
                : ActionKind.Idle
              : ActionKind.KnockedOut,
            0,
            stormMode ? CHARGE_TICKS : age * 20,
            false,
            'forward',
          ),
          locomotion: { speed: 0, airborne: false },
          groundHeight: terrain.heightAt,
        },
        0,
        stormMode,
      );
    }
    effect.update(age);
    if (params.has('before') || stormMode) effect.clear();
    if (stormArt) {
      const storm = stormAt(age);
      stormArt.update(params.has('before') ? null : storm, age, reduced);
      showStormHud(storm);
    }
    if (!stormMode && age >= KING_VICTORY_SECONDS && shown) {
      shown = false;
      root.render(null);
      stopSound();
    }
    bursts.update(1 / 60);
    renderer.render(scene, camera);
    document.body.dataset.victoryFrame = String(++frames);
    if (frames >= 3) document.body.dataset.galleryReady = 'true';
  });
  const hidden = () => {
    if (document.hidden) stopSound();
  };
  document.addEventListener('visibilitychange', hidden);
  window.addEventListener(
    'pagehide',
    () => {
      renderer.setAnimationLoop(null);
      stopSound();
      root.unmount();
      holder.remove();
      toolbar.remove();
      effect.dispose();
      stormArt?.dispose();
      king?.dispose();
      bursts.dispose();
      forest.dispose();
      ruins.dispose();
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', hidden);
    },
    { once: true },
  );
}
