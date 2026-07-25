import {
  BackSide,
  BoxGeometry,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
} from "three";

/**
 * A tiny emissive studio that gets baked into an environment map. This is what
 * gives the shell its long upper-left specular streak and blue rim reflections,
 * the parts a flat CSS gradient cannot fake.
 */
const PANELS = [
  // Soft key light, upper left: the long diagonal sheen.
  { size: [8, 5.5], position: [-6.4, 6.8, 7.2], rgb: [2.2, 2.3, 2.5] },
  // Small hot spot that reads as the sharp glint.
  { size: [1.5, 1.5], position: [-2.9, 3.9, 8.4], rgb: [9, 9, 9.4] },
  // Blue wrap from behind, left and right.
  { size: [14, 14], position: [-9.5, -0.5, -2.5], rgb: [0.05, 0.3, 1.0] },
  { size: [14, 14], position: [9.5, -0.8, -2.5], rgb: [0.04, 0.24, 0.85] },
  // Blue wall behind the ball for the halo.
  { size: [20, 20], position: [0, 0.5, -12], rgb: [0.035, 0.2, 0.7] },
  // Cool top fill.
  { size: [12, 12], position: [0, 11, 0], rgb: [0.08, 0.18, 0.4] },
  // Dark ground so the underside stays deep.
  { size: [24, 24], position: [0, -7, 0], rgb: [0.005, 0.016, 0.045] },
];

export function createStudioEnvironment(renderer) {
  const scene = new Scene();

  const room = new Mesh(
    new BoxGeometry(48, 48, 48),
    new MeshBasicMaterial({ side: BackSide })
  );
  room.material.color.setRGB(0.0012, 0.0045, 0.013, LinearSRGBColorSpace);
  scene.add(room);

  for (const panel of PANELS) {
    const material = new MeshBasicMaterial();
    material.color.setRGB(...panel.rgb, LinearSRGBColorSpace);
    const mesh = new Mesh(new PlaneGeometry(...panel.size), material);
    mesh.position.set(...panel.position);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  }

  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.03);
  pmrem.dispose();

  scene.traverse((object) => {
    if (object.isMesh) {
      object.geometry.dispose();
      object.material.dispose();
    }
  });

  return target.texture;
}
