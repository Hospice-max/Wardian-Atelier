import * as THREE from 'three';
import { TERRARIUM_BOUNDS } from './math';
import type { TerrariumMaterialLibrary } from './materials';

export interface TerrariumVesselRig {
  group: THREE.Group;
  leftVentPivot: THREE.Group;
  rightVentPivot: THREE.Group;
  frontDoorPivot: THREE.Group;
  frontDoorInteractable: THREE.Object3D;
  growLampBulb: THREE.Mesh;
  growLampMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createTerrariumVessel(materials: TerrariumMaterialLibrary): TerrariumVesselRig {
  const group = new THREE.Group();
  group.name = 'WardianVessel';
  const geometries: THREE.BufferGeometry[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  const { halfW, halfD, plinthHeight, eaveY, ridgeY } = TERRARIUM_BOUNDS;

  // 1. Studio tabletop disc + radial contact shadow flush at y = 0
  const tableGeo = trackGeo(new THREE.CylinderGeometry(11.5, 11.8, 0.24, 64));
  const tableMesh = new THREE.Mesh(tableGeo, materials.studioTable);
  tableMesh.position.y = -0.12;
  tableMesh.receiveShadow = true;
  group.add(tableMesh);

  const shadowGeo = trackGeo(new THREE.PlaneGeometry(7.8, 5.9));
  const shadowMesh = new THREE.Mesh(shadowGeo, materials.contactShadow);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.005;
  group.add(shadowMesh);

  // 2. Stepped Walnut & Brass Pedestal Plinth (y = 0 to y = 0.42)
  const footGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.14, 0.08, 16));
  const footPositions: [number, number][] = [
    [-halfW + 0.18, -halfD + 0.18],
    [halfW - 0.18, -halfD + 0.18],
    [-halfW + 0.18, halfD - 0.18],
    [halfW - 0.18, halfD - 0.18],
  ];
  for (const [fx, fz] of footPositions) {
    const foot = new THREE.Mesh(footGeo, materials.brushedBrass);
    foot.position.set(fx, 0.04, fz);
    foot.castShadow = true;
    foot.receiveShadow = true;
    group.add(foot);
  }

  // Lower plinth skirt
  const lowerPlinthGeo = trackGeo(new THREE.BoxGeometry(halfW * 2 + 0.28, 0.16, halfD * 2 + 0.28));
  const lowerPlinth = new THREE.Mesh(lowerPlinthGeo, materials.walnutPlinth);
  lowerPlinth.position.y = 0.14;
  lowerPlinth.castShadow = true;
  lowerPlinth.receiveShadow = true;
  group.add(lowerPlinth);

  // Upper beveled walnut rim
  const upperPlinthGeo = trackGeo(new THREE.BoxGeometry(halfW * 2 + 0.12, 0.16, halfD * 2 + 0.12));
  const upperPlinth = new THREE.Mesh(upperPlinthGeo, materials.walnutPlinth);
  upperPlinth.position.y = 0.30;
  upperPlinth.castShadow = true;
  upperPlinth.receiveShadow = true;
  group.add(upperPlinth);

  // Recessed dark bronze tray liner
  const trayGeo = trackGeo(new THREE.BoxGeometry(halfW * 2 - 0.04, 0.06, halfD * 2 - 0.04));
  const trayMesh = new THREE.Mesh(trayGeo, materials.bronzeFrame);
  trayMesh.position.y = plinthHeight - 0.02;
  trayMesh.receiveShadow = true;
  group.add(trayMesh);

  // Brass corner brackets on plinth
  const bracketGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.19, 0.24));
  for (const [bx, bz] of footPositions) {
    const bracket = new THREE.Mesh(bracketGeo, materials.brushedBrass);
    bracket.position.set(bx * 1.03, 0.22, bz * 1.03);
    bracket.castShadow = true;
    group.add(bracket);
  }

  // Front engraved brass nameplate plaque
  const plaqueBackingGeo = trackGeo(new THREE.BoxGeometry(1.18, 0.22, 0.03));
  const plaqueBacking = new THREE.Mesh(plaqueBackingGeo, materials.brushedBrass);
  plaqueBacking.position.set(0, 0.22, halfD + 0.14);
  group.add(plaqueBacking);

  const plaqueFaceGeo = trackGeo(new THREE.PlaneGeometry(1.12, 0.18));
  const plaqueFace = new THREE.Mesh(plaqueFaceGeo, materials.plaqueFace);
  plaqueFace.position.set(0, 0.22, halfD + 0.157);
  group.add(plaqueFace);

  // 3. Architectural Bronze Mullions & Gable Frame
  const wallH = eaveY - plinthHeight;
  const postRadius = 0.045;
  const postGeo = trackGeo(new THREE.BoxGeometry(postRadius * 2, wallH, postRadius * 2));

  // 4 corner posts + back center mullion
  const postCoords: [number, number][] = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [-halfW, halfD],
    [halfW, halfD],
    [0, -halfD],
  ];
  for (const [px, pz] of postCoords) {
    const post = new THREE.Mesh(postGeo, materials.bronzeFrame);
    post.position.set(px, plinthHeight + wallH / 2, pz);
    post.castShadow = true;
    group.add(post);

    // Subtle brass collar accents at base & eave
    const collarGeo = trackGeo(new THREE.BoxGeometry(0.115, 0.05, 0.115));
    const collarTop = new THREE.Mesh(collarGeo, materials.brushedBrass);
    collarTop.position.set(px, eaveY - 0.025, pz);
    group.add(collarTop);
  }

  // Front Doorway Jamb Mullions & Substrate Retaining Transom (y = 1.06)
  const doorSillY = 1.06;
  const doorHalfW = 0.85;
  const upperDoorWallH = eaveY - doorSillY;
  const jambGeo = trackGeo(new THREE.BoxGeometry(0.075, upperDoorWallH, 0.085));
  for (const xSign of [-1, 1]) {
    const jamb = new THREE.Mesh(jambGeo, materials.bronzeFrame);
    jamb.position.set(xSign * doorHalfW, doorSillY + upperDoorWallH / 2, halfD);
    jamb.castShadow = true;
    group.add(jamb);
  }

  // Horizontal sill, front retaining transom, & eave beams
  const longBeamGeo = trackGeo(new THREE.BoxGeometry(halfW * 2 + 0.09, 0.075, 0.085));
  const shortBeamGeo = trackGeo(new THREE.BoxGeometry(0.085, 0.075, halfD * 2 + 0.09));

  const frontRetainingBeam = new THREE.Mesh(longBeamGeo, materials.bronzeFrame);
  frontRetainingBeam.position.set(0, doorSillY, halfD);
  frontRetainingBeam.castShadow = true;
  group.add(frontRetainingBeam);

  for (const yPos of [plinthHeight + 0.03, eaveY]) {
    for (const zSign of [-1, 1]) {
      const beam = new THREE.Mesh(longBeamGeo, materials.bronzeFrame);
      beam.position.set(0, yPos, zSign * halfD);
      beam.castShadow = true;
      group.add(beam);
    }
    for (const xSign of [-1, 1]) {
      const beam = new THREE.Mesh(shortBeamGeo, materials.bronzeFrame);
      beam.position.set(xSign * halfW, yPos, 0);
      beam.castShadow = true;
      group.add(beam);
    }
  }

  // Pitched Gable Roof Geometry Math
  const roofRise = ridgeY - eaveY;
  const roofRun = halfD;
  const slopeLen = Math.hypot(roofRise, roofRun);
  const slopeAngle = Math.atan2(roofRise, roofRun);

  // Ridge beam + decorative brass cresting + finials
  const ridgeBeamGeo = trackGeo(new THREE.BoxGeometry(halfW * 2 + 0.12, 0.09, 0.09));
  const ridgeBeam = new THREE.Mesh(ridgeBeamGeo, materials.bronzeFrame);
  ridgeBeam.position.set(0, ridgeY, 0);
  ridgeBeam.castShadow = true;
  group.add(ridgeBeam);

  // Ornamental ridge crest rail & spire finials
  const crestRailGeo = trackGeo(new THREE.BoxGeometry(halfW * 2 - 0.3, 0.03, 0.03));
  const crestRail = new THREE.Mesh(crestRailGeo, materials.brushedBrass);
  crestRail.position.set(0, ridgeY + 0.12, 0);
  group.add(crestRail);

  const finialPoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.065, 0.02),
    new THREE.Vector2(0.04, 0.08),
    new THREE.Vector2(0.055, 0.13),
    new THREE.Vector2(0.022, 0.21),
    new THREE.Vector2(0, 0.30),
  ];
  const finialGeo = trackGeo(new THREE.LatheGeometry(finialPoints, 20));
  for (const xPos of [-halfW + 0.08, 0, halfW - 0.08]) {
    const finial = new THREE.Mesh(finialGeo, materials.brushedBrass);
    finial.position.set(xPos, ridgeY + 0.04, 0);
    group.add(finial);
  }

  // Roof rafters along X = -halfW, 0, +halfW
  const rafterGeo = trackGeo(new THREE.BoxGeometry(0.07, 0.06, slopeLen + 0.06));
  for (const xPos of [-halfW, 0, halfW]) {
    for (const zSign of [-1, 1]) {
      const rafter = new THREE.Mesh(rafterGeo, materials.bronzeFrame);
      rafter.position.set(xPos, eaveY + roofRise / 2, (zSign * roofRun) / 2);
      rafter.rotation.x = zSign * slopeAngle;
      rafter.castShadow = true;
      group.add(rafter);
    }
  }

  // Interior warm conservatory brass lamp suspended beneath ridge
  const lampCordGeo = trackGeo(new THREE.CylinderGeometry(0.015, 0.015, 0.36, 8));
  const lampCord = new THREE.Mesh(lampCordGeo, materials.brushedBrass);
  lampCord.position.set(0, ridgeY - 0.18, 0);
  group.add(lampCord);

  const lampShadeGeo = trackGeo(new THREE.ConeGeometry(0.24, 0.14, 24, 1, true));
  const lampShade = new THREE.Mesh(lampShadeGeo, materials.bronzeFrame);
  lampShade.position.set(0, ridgeY - 0.36, 0);
  group.add(lampShade);

  const growLampMat = new THREE.MeshStandardMaterial({
    color: 0xffe4b3,
    emissive: 0xffba66,
    emissiveIntensity: 0.0,
    roughness: 0.25,
  });
  const bulbGeo = trackGeo(new THREE.SphereGeometry(0.075, 16, 12));
  const growLampBulb = new THREE.Mesh(bulbGeo, growLampMat);
  growLampBulb.position.set(0, ridgeY - 0.41, 0);
  group.add(growLampBulb);

  // 4. Glass Walls & Condensation Overlays (depthWrite: false, renderOrder: 10+)
  const addGlassPane = (
    w: number,
    h: number,
    pos: [number, number, number],
    rot: [number, number, number],
    parent: THREE.Object3D = group,
  ) => {
    const gGeo = trackGeo(new THREE.PlaneGeometry(w, h));
    const glass = new THREE.Mesh(gGeo, materials.glassPane);
    glass.position.set(...pos);
    glass.rotation.set(...rot);
    glass.renderOrder = 12;
    parent.add(glass);

    const cond = new THREE.Mesh(gGeo, materials.condensationOverlay);
    cond.position.set(...pos);
    cond.rotation.set(...rot);
    cond.renderOrder = 11;
    parent.add(cond);
  };

  // Front lower retaining glass + left & right fixed sidelights (leaving doorway open)
  const lowerFrontH = doorSillY - plinthHeight - 0.05;
  addGlassPane(
    halfW * 2 - 0.08,
    lowerFrontH,
    [0, plinthHeight + 0.03 + lowerFrontH / 2, halfD - 0.01],
    [0, 0, 0],
  );

  const sidelightW = halfW - doorHalfW - 0.06;
  const sidelightCenterX = doorHalfW + 0.03 + sidelightW / 2;
  const upperDoorCenterY = doorSillY + upperDoorWallH / 2;
  addGlassPane(
    sidelightW,
    upperDoorWallH - 0.06,
    [-sidelightCenterX, upperDoorCenterY, halfD - 0.01],
    [0, 0, 0],
  );
  addGlassPane(
    sidelightW,
    upperDoorWallH - 0.06,
    [sidelightCenterX, upperDoorCenterY, halfD - 0.01],
    [0, 0, 0],
  );

  // Back glass wall
  addGlassPane(halfW * 2 - 0.08, wallH - 0.06, [0, plinthHeight + wallH / 2, -halfD + 0.01], [0, Math.PI, 0]);

  // 4b. Hinged Front Conservatory Entrance Door (pivoted at left jamb x = -doorHalfW)
  const doorWidth = doorHalfW * 2 - 0.07;
  const doorHeight = upperDoorWallH - 0.08;
  const frontDoorPivot = new THREE.Group();
  frontDoorPivot.name = 'FrontEntranceDoorPivot';
  frontDoorPivot.position.set(-doorHalfW + 0.035, doorSillY + 0.04, halfD);
  group.add(frontDoorPivot);

  const stileW = 0.06;
  const stileGeo = trackGeo(new THREE.BoxGeometry(stileW, doorHeight, 0.055));
  const railGeo = trackGeo(new THREE.BoxGeometry(doorWidth, stileW, 0.055));
  const muntinGeo = trackGeo(new THREE.BoxGeometry(doorWidth - stileW * 2, 0.032, 0.04));

  const leftStile = new THREE.Mesh(stileGeo, materials.bronzeFrame);
  leftStile.position.set(stileW / 2, doorHeight / 2, 0);
  leftStile.castShadow = true;
  frontDoorPivot.add(leftStile);

  const rightStile = new THREE.Mesh(stileGeo, materials.bronzeFrame);
  rightStile.position.set(doorWidth - stileW / 2, doorHeight / 2, 0);
  rightStile.castShadow = true;
  frontDoorPivot.add(rightStile);

  const bottomRail = new THREE.Mesh(railGeo, materials.bronzeFrame);
  bottomRail.position.set(doorWidth / 2, stileW / 2, 0);
  bottomRail.castShadow = true;
  frontDoorPivot.add(bottomRail);

  const topRail = new THREE.Mesh(railGeo, materials.bronzeFrame);
  topRail.position.set(doorWidth / 2, doorHeight - stileW / 2, 0);
  topRail.castShadow = true;
  frontDoorPivot.add(topRail);

  const midMuntin = new THREE.Mesh(muntinGeo, materials.bronzeFrame);
  midMuntin.position.set(doorWidth / 2, doorHeight * 0.48, 0);
  frontDoorPivot.add(midMuntin);

  // Brushed brass barrel hinges on left stile
  const hingeGeo = trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.11, 12));
  for (const hy of [0.28, doorHeight - 0.28]) {
    const hinge = new THREE.Mesh(hingeGeo, materials.brushedBrass);
    hinge.position.set(0, hy, 0.032);
    frontDoorPivot.add(hinge);
  }

  // Brushed brass escutcheon plate & lever handle on right stile
  const plateGeo = trackGeo(new THREE.BoxGeometry(0.045, 0.18, 0.018));
  const latchNeckGeo = trackGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 10));
  latchNeckGeo.rotateX(Math.PI / 2);
  const leverGeo = trackGeo(new THREE.BoxGeometry(0.12, 0.02, 0.022));

  for (const zDir of [-1, 1]) {
    const plate = new THREE.Mesh(plateGeo, materials.brushedBrass);
    plate.position.set(doorWidth - stileW / 2, doorHeight * 0.48, zDir * 0.036);
    frontDoorPivot.add(plate);

    const neck = new THREE.Mesh(latchNeckGeo, materials.brushedBrass);
    neck.position.set(doorWidth - stileW / 2, doorHeight * 0.48, zDir * 0.062);
    frontDoorPivot.add(neck);

    const lever = new THREE.Mesh(leverGeo, materials.brushedBrass);
    lever.position.set(doorWidth - stileW / 2 - 0.048, doorHeight * 0.48, zDir * 0.088);
    frontDoorPivot.add(lever);
  }

  // Tag door frame & brass hardware on Layer 1 (before adding glass) so interior flora stays clickable through glass
  frontDoorPivot.userData.action = 'toggle-door';
  frontDoorPivot.traverse((child) => {
    child.layers.enable(1);
    child.userData.action = 'toggle-door';
  });

  // Door glass + condensation pane
  addGlassPane(
    doorWidth - stileW * 2 + 0.01,
    doorHeight - stileW * 2 + 0.01,
    [doorWidth / 2, doorHeight / 2, 0],
    [0, 0, 0],
    frontDoorPivot,
  );

  // Left & Right side walls
  addGlassPane(halfD * 2 - 0.08, wallH - 0.06, [-halfW + 0.01, plinthHeight + wallH / 2, 0], [0, -Math.PI / 2, 0]);
  addGlassPane(halfD * 2 - 0.08, wallH - 0.06, [halfW - 0.01, plinthHeight + wallH / 2, 0], [0, Math.PI / 2, 0]);

  // Left & Right gable triangles
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-halfD + 0.04, 0);
  gableShape.lineTo(halfD - 0.04, 0);
  gableShape.lineTo(0, roofRise - 0.03);
  gableShape.closePath();
  const gableGeo = trackGeo(new THREE.ShapeGeometry(gableShape));

  for (const xSign of [-1, 1]) {
    const gableGlass = new THREE.Mesh(gableGeo, materials.glassPane);
    gableGlass.position.set(xSign * (halfW - 0.01), eaveY, 0);
    gableGlass.rotation.y = xSign > 0 ? Math.PI / 2 : -Math.PI / 2;
    gableGlass.renderOrder = 12;
    group.add(gableGlass);

    const gableCond = new THREE.Mesh(gableGeo, materials.condensationOverlay);
    gableCond.position.set(xSign * (halfW - 0.015), eaveY, 0);
    gableCond.rotation.y = xSign > 0 ? Math.PI / 2 : -Math.PI / 2;
    gableCond.renderOrder = 11;
    group.add(gableCond);
  }

  // 5. Hinged Roof Vent Panels (hinged at the ridge y=ridgeY, z=0)
  const leftVentPivot = new THREE.Group();
  leftVentPivot.position.set(0, ridgeY, 0);
  group.add(leftVentPivot);

  const rightVentPivot = new THREE.Group();
  rightVentPivot.position.set(0, ridgeY, 0);
  group.add(rightVentPivot);

  const buildRoofSlope = (pivot: THREE.Group, zSign: -1 | 1) => {
    const slopePanel = new THREE.Group();
    slopePanel.rotation.x = zSign * slopeAngle;
    pivot.add(slopePanel);

    const paneW = halfW * 2 - 0.1;
    const paneGeo = trackGeo(new THREE.PlaneGeometry(paneW, slopeLen - 0.06));
    const glass = new THREE.Mesh(paneGeo, materials.glassPane);
    glass.rotation.x = -Math.PI / 2;
    glass.position.set(0, 0, (zSign * slopeLen) / 2);
    glass.renderOrder = 12;
    slopePanel.add(glass);

    const cond = new THREE.Mesh(paneGeo, materials.condensationOverlay);
    cond.rotation.x = -Math.PI / 2;
    cond.position.set(0, -0.008, (zSign * slopeLen) / 2);
    cond.renderOrder = 11;
    slopePanel.add(cond);

    // Thin brass frame edge around the hinged roof panel
    const eaveTrimGeo = trackGeo(new THREE.BoxGeometry(paneW, 0.035, 0.04));
    const eaveTrim = new THREE.Mesh(eaveTrimGeo, materials.brushedBrass);
    eaveTrim.position.set(0, 0.01, zSign * (slopeLen - 0.03));
    slopePanel.add(eaveTrim);
  };

  buildRoofSlope(leftVentPivot, -1);
  buildRoofSlope(rightVentPivot, 1);

  return {
    group,
    leftVentPivot,
    rightVentPivot,
    frontDoorPivot,
    frontDoorInteractable: frontDoorPivot,
    growLampBulb,
    growLampMat,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      growLampMat.dispose();
    },
  };
}
