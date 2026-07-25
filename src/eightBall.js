import {
  AdditiveBlending,
  DoubleSide,
  Group,
  LatheGeometry,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from "three";

const BALL_RADIUS = 1;
const WINDOW_RADIUS = 0.335;
const CAVITY_RADIUS = 0.3;
const CAVITY_FLOOR_Z = 0.79;
const DIE_SIZE = 0.47;

export const RIM_Z = Math.sqrt(BALL_RADIUS ** 2 - WINDOW_RADIUS ** 2);

/**
 * The shell is a lathed profile rather than a plain sphere so the window is a
 * genuine recess in the geometry: sphere surface, then a bezel wall turning
 * inward, then a flat cavity floor the die floats above.
 */
function createShellGeometry() {
  const points = [];
  const steps = 150;
  const thetaHole = Math.asin(WINDOW_RADIUS / BALL_RADIUS);

  for (let i = 0; i <= steps; i += 1) {
    const theta = Math.PI - (i / steps) * (Math.PI - thetaHole);
    points.push(
      new Vector2(Math.sin(theta) * BALL_RADIUS, Math.cos(theta) * BALL_RADIUS)
    );
  }

  points.push(new Vector2(WINDOW_RADIUS * 0.99, RIM_Z - 0.03));
  points.push(new Vector2(CAVITY_RADIUS, RIM_Z - 0.075));
  points.push(new Vector2(CAVITY_RADIUS, CAVITY_FLOOR_Z + 0.03));
  points.push(new Vector2(CAVITY_RADIUS * 0.82, CAVITY_FLOOR_Z));
  points.push(new Vector2(0, CAVITY_FLOOR_Z - 0.012));

  return new LatheGeometry(points, 192);
}

export function createEightBall({ triangleTexture, markTexture, glowTexture }) {
  const group = new Group();

  const shell = new Mesh(
    createShellGeometry(),
    new MeshPhysicalMaterial({
      color: 0x030304,
      roughness: 0.08,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 0.5,
      side: DoubleSide,
    })
  );
  shell.rotation.x = Math.PI / 2;
  shell.castShadow = true;
  group.add(shell);

  const bezel = new Mesh(
    new TorusGeometry(WINDOW_RADIUS + 0.013, 0.015, 20, 180),
    new MeshPhysicalMaterial({
      color: 0x080a0e,
      roughness: 0.38,
      metalness: 0.7,
      envMapIntensity: 0.55,
    })
  );
  bezel.position.z = RIM_Z - 0.006;
  group.add(bezel);

  const ring = new Mesh(
    new TorusGeometry(WINDOW_RADIUS - 0.005, 0.008, 18, 180),
    new MeshPhysicalMaterial({
      color: 0x9aa8b8,
      roughness: 0.3,
      metalness: 1,
      envMapIntensity: 0.85,
    })
  );
  ring.position.z = RIM_Z + 0.001;
  group.add(ring);

  // Shallow glass cap: curved so it catches the key light like the reference.
  const glassRadius = 0.9;
  const glassTheta = Math.asin(WINDOW_RADIUS / glassRadius);
  const glass = new Mesh(
    new SphereGeometry(glassRadius, 72, 36, 0, Math.PI * 2, 0, glassTheta),
    new MeshPhysicalMaterial({
      color: 0x08131f,
      roughness: 0.03,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 0.9,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    })
  );
  glass.rotation.x = Math.PI / 2;
  glass.position.z = RIM_Z - glassRadius * Math.cos(glassTheta);
  glass.renderOrder = 4;
  group.add(glass);

  // Bloom source sitting behind the die so the window reads as lit from within.
  const halo = new Mesh(
    new PlaneGeometry(DIE_SIZE * 1.6, DIE_SIZE * 1.6),
    new MeshBasicMaterial({
      map: glowTexture,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    })
  );
  halo.material.color.setRGB(0.09, 0.24, 0.6, LinearSRGBColorSpace);
  halo.position.z = CAVITY_FLOOR_Z + 0.02;
  group.add(halo);

  const dieGroup = new Group();
  dieGroup.position.z = CAVITY_FLOOR_Z + 0.055;
  group.add(dieGroup);

  const face = new Mesh(
    new PlaneGeometry(DIE_SIZE, DIE_SIZE),
    new MeshBasicMaterial({ map: triangleTexture, transparent: true })
  );
  face.material.color.setRGB(0.95, 0.95, 0.95, LinearSRGBColorSpace);
  dieGroup.add(face);

  const mark = new Mesh(
    new PlaneGeometry(DIE_SIZE, DIE_SIZE),
    new MeshBasicMaterial({
      map: markTexture,
      transparent: true,
      depthWrite: false,
    })
  );
  mark.position.z = 0.002;
  dieGroup.add(mark);

  const words = new Mesh(
    new PlaneGeometry(DIE_SIZE, DIE_SIZE),
    new MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      opacity: 0,
    })
  );
  words.position.z = 0.004;
  words.visible = false;
  dieGroup.add(words);

  return { group, shell, dieGroup, face, mark, words, halo, glass };
}
