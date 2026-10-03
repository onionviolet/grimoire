import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, OrbitControls, useGLTF } from '@react-three/drei';

function Model({ url }: { url: string }) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  return <primitive object={scene} />;
}

/** Static inspection preview. The exported GLB carries embedded textures. */
export default function ModelAssetPreview({ url }: { url: string }) {
  return <Canvas camera={{ position: [4, 3, 5], fov: 45 }} dpr={[1, 1.5]} frameloop="demand">
    <ambientLight intensity={1} />
    <directionalLight position={[3, 5, 4]} intensity={2} />
    <directionalLight position={[-4, 2, -3]} intensity={0.5} />
    <Suspense fallback={null}>
      <Bounds fit clip observe margin={1.3}><Model url={url} /></Bounds>
    </Suspense>
    <OrbitControls makeDefault />
  </Canvas>;
}
