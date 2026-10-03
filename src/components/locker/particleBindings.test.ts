import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { allSpriteLayers, spriteParamsFor, type FxDescriptor } from './fxDescriptor';
import { particleColor, resolveParticleAttachment, particleAttachmentPosition } from './particleBindings';
function descriptor(): FxDescriptor {
  return { name: 'test', constantColor: [255, 0, 0], controlPoints: [{ cp: 2, attachment: 'ability_cast', attachType: 'PATTACH_POINT_FOLLOW', entity: null }],
    emitters: [{ class: 'C_OP_ContinuousEmitter', params: { m_flEmitRate: 2 } }],
    initializers: [{ class: 'C_INIT_RandomColor', params: { m_ColorMin: [255, 0, 0], m_ColorMax: [0, 0, 255] } }],
    operators: [{ class: 'C_OP_ColorInterpolate', params: { m_ColorFade: [0, 255, 0], m_flFadeStartTime: 0.25, m_flFadeEndTime: 0.75 } }, { class: 'C_OP_PositionLock', params: { m_nControlPointNumber: 2 } }],
    renderers: [{ class: 'C_OP_RenderSprites', params: {}, mode: 'sprite', blendMode: null, textures: [] }], children: [] };
}
describe('authored sprite colors and attachments', () => {
  it('inherits the parent CP driver without losing a child override', () => {
    const parent = descriptor(), child = descriptor(); child.controlPoints = []; parent.children = [child];
    expect(allSpriteLayers(parent)[1]).toMatchObject({ controlPoint: 2, attachment: 'ability_cast', positionLocked: true, emitRate: 2 });
    child.controlPoints = [{ cp: 2, attachment: 'weapon_tip', attachType: null, entity: null }];
    expect(allSpriteLayers(parent)[1].attachment).toBe('weapon_tip');
  });
  it('does not substitute the origin for an unresolved attachment or CP', () => {
    const scene = new THREE.Group(); const hand = new THREE.Group(); hand.name = 'ability_cast'; scene.add(hand);
    expect(resolveParticleAttachment(scene, 2, 'ability_cast')).toBe(hand);
    expect(resolveParticleAttachment(scene, 2, 'missing')).toBeNull();
    expect(resolveParticleAttachment(scene, 2, null)).toBeNull();
    expect(resolveParticleAttachment(scene, 0, null)).toBe(scene);
  });
  it('injects authored weighted offsets through animated bone transforms and model scale', () => {
    const model = new THREE.Group(), skeleton = new THREE.Group(), hand = new THREE.Group();
    skeleton.name = 'skeleton'; skeleton.scale.setScalar(0.0254); skeleton.rotation.x = -Math.PI / 2;
    hand.name = 'hand_R'; hand.position.set(10, 0, 60); skeleton.add(hand); model.add(skeleton);
    const definitions = [{ name: 'ability_cast', influences: [{ bone: 'hand_R', offset: [0, 0, 5] as [number, number, number], weight: 1, rootTransform: false }] }];
    const target = new THREE.Vector3();
    expect(particleAttachmentPosition(model, 2, 'ability_cast', definitions, target)).toBe(true);
    expect(target.x).toBeCloseTo(0.254); expect(target.y).toBeCloseTo(1.651); expect(target.z).toBeCloseTo(0);
    hand.position.x = 20;
    particleAttachmentPosition(model, 2, 'ability_cast', definitions, target);
    expect(target.x).toBeCloseTo(0.508);
    expect(particleAttachmentPosition(model, 2, 'unknown', definitions, target)).toBe(false);
  });
  it('uses RandomColor endpoints and interpolates only within the authored window', () => {
    const layer = spriteParamsFor(descriptor())!;
    expect(layer.colorMin).toEqual([1, 0, 0]); expect(layer.colorMax).toEqual([0, 0, 1]);
    expect(particleColor(layer, [1, 0, 0], 0)).toEqual([1, 0, 0]);
    expect(particleColor(layer, [1, 0, 0], 0.5)).toEqual([0.5, 0.5, 0]);
    expect(particleColor(layer, [1, 0, 0], 1)).toEqual([0, 1, 0]);
  });
  it('applies the persisted hue after color interpolation and preserves neutral highlights', () => {
    const layer = spriteParamsFor(descriptor())!;
    const recolored = particleColor(layer, [1, 0, 0], 0, { hue: 240, saturation: 1, brightness: 0.5 });
    recolored.forEach((value, index) => expect(value).toBeCloseTo([0, 0, 0.5][index]));
    const plain = { ...layer, colorEnd: null };
    expect(particleColor(plain, [1, 1, 1], 0, { hue: 240, saturation: 1, brightness: 1 })).toEqual([1, 1, 1]);
  });
});
