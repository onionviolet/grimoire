import React from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  HeroPreviewAppearance,
  type HeroPreviewAppearanceFeatures,
} from './HeroPreviewScene';
import { normalizeHeroPreview } from './heroPreviewSceneSetup';
import { ADDITIVE_OVERLAY_RENDER_ORDER } from '../../lib/source2Preview/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function previewScene() {
  const scene = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 4, 1);
  geometry.setAttribute('color', new THREE.BufferAttribute(
    new Float32Array(geometry.attributes.position.count * 3).fill(1), 3
  ));
  const bodyMaterial = new THREE.MeshStandardMaterial();
  bodyMaterial.userData = { morphic: { shader: 'pbr.vfx', ints: { F_USE_NPR_LIGHTING: 1, F_VERTEX_COLOR: 1 } } };
  const body = new THREE.Mesh(geometry, bodyMaterial);
  body.position.set(0, 2, 0);
  const glowMaterial = new THREE.MeshStandardMaterial();
  glowMaterial.userData = { morphic: {
    shader: 'pbr.vfx', blend_mode: 'additive', ints: { F_SELF_ILLUM: 1 },
    floats: { g_flSelfIllumScale1: 2 },
  } };
  const glow = new THREE.Mesh(geometry, glowMaterial);
  scene.add(body, glow);
  return { scene, body, bodyMaterial, glow, glowMaterial };
}

const rawFeatures: HeroPreviewAppearanceFeatures = {
  source2ShaderHintsEnabled: false,
  nprDebugEnabled: false,
  source2SkipNpr: false,
  nprMaterialsEnabled: false,
  unifiedEnabled: false,
  celV2Enabled: false,
};

type PreviewMaterial = THREE.Material & { uniforms: Record<string, THREE.IUniform> };

describe('shared hero preview appearance', () => {
  it('applies real unified body and self-illum materials and restores originals on unmount', async () => {
    const { scene, body, bodyMaterial, glow, glowMaterial } = previewScene();
    const disposeOriginal = vi.spyOn(bodyMaterial, 'dispose');
    const renderer = await ReactThreeTestRenderer.create(
      React.createElement(HeroPreviewAppearance, { scene })
    );
    const bodyPreview = body.material as unknown as PreviewMaterial;
    const disposePreview = vi.spyOn(bodyPreview, 'dispose');

    expect(bodyPreview).not.toBe(bodyMaterial);
    expect(bodyPreview.uniforms.uCelV2.value).toBe(1);
    expect((bodyPreview as unknown as THREE.MeshStandardMaterial).vertexColors).toBe(true);
    expect(glow.material).not.toBe(glowMaterial);
    expect((glow.material as THREE.Material).blending).toBe(THREE.AdditiveBlending);
    expect(glow.renderOrder).toBe(ADDITIVE_OVERLAY_RENDER_ORDER);

    await renderer.unmount();

    expect(body.material).toBe(bodyMaterial);
    expect(glow.material).toBe(glowMaterial);
    expect(glowMaterial.blending).toBe(THREE.NormalBlending);
    expect(glowMaterial.transparent).toBe(false);
    expect(glow.renderOrder).toBe(0);
    expect(disposePreview).toHaveBeenCalledOnce();
    expect(disposeOriginal).not.toHaveBeenCalled();
  });

  it('updates tint and cel uniforms in place without rebuilding an animated scene', async () => {
    const { scene, body } = previewScene();
    const renderer = await ReactThreeTestRenderer.create(
      React.createElement(HeroPreviewAppearance, { scene })
    );
    const material = body.material as unknown as PreviewMaterial;
    const tint = new THREE.Color(0.2, 0.4, 0.8);
    const features = { ...rawFeatures, source2ShaderHintsEnabled: true,
      source2SkipNpr: true, nprMaterialsEnabled: true, unifiedEnabled: true };

    await renderer.update(React.createElement(HeroPreviewAppearance, { scene, tint, features }));

    expect(body.material).toBe(material);
    expect((material.uniforms.uTintColor.value as THREE.Color).toArray()).toEqual(tint.toArray());
    expect(material.uniforms.uCelV2.value).toBe(0);
    await renderer.update(React.createElement(HeroPreviewAppearance, { scene, features }));
    expect(body.material).toBe(material);
    expect((material.uniforms.uTintColor.value as THREE.Color).toArray()).toEqual([1, 1, 1]);
    await renderer.unmount();
  });

  it('keeps overlay draw state active when raw-material development flags disable styling', async () => {
    const { scene, body, bodyMaterial, glow, glowMaterial } = previewScene();
    const renderer = await ReactThreeTestRenderer.create(
      React.createElement(HeroPreviewAppearance, { scene, features: rawFeatures })
    );

    expect(body.material).toBe(bodyMaterial);
    expect(glow.material).toBe(glowMaterial);
    expect(bodyMaterial.vertexColors).toBe(true);
    expect(glowMaterial.blending).toBe(THREE.AdditiveBlending);
    expect(glow.renderOrder).toBe(ADDITIVE_OVERLAY_RENDER_ORDER);
    await renderer.unmount();
    expect(glowMaterial.blending).toBe(THREE.NormalBlending);
  });
});

describe('shared hero preview framing', () => {
  it('normalizes native model extents while leaving the animation root graph intact', () => {
    const scene = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), new THREE.MeshStandardMaterial());
    mesh.position.y = 2;
    scene.add(mesh);

    const norm = normalizeHeroPreview(scene);

    expect(norm.scale).toBe(0.5);
    expect(norm.center.toArray()).toEqual([0, 2, 0]);
    expect(mesh.parent).toBe(scene);
    expect(mesh.position.toArray()).toEqual([0, 2, 0]);
  });

  it('resets a skinned scene to its bind pose before measuring fixed framing', () => {
    const scene = new THREE.Group();
    const bone = new THREE.Bone();
    const mesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(1, 4, 1), new THREE.MeshStandardMaterial());
    const count = mesh.geometry.attributes.position.count;
    mesh.geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
    const weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) weights[i * 4] = 1;
    mesh.geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    mesh.add(bone);
    mesh.bind(new THREE.Skeleton([bone]));
    scene.add(mesh);
    bone.position.x = 10;

    const norm = normalizeHeroPreview(scene, { bindPose: true });

    expect(bone.position.x).toBe(0);
    expect(norm.scale).toBe(0.5);
    expect(norm.center.x).toBe(0);
    expect(bone.parent).toBe(mesh);
  });
});
