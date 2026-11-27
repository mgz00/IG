import { SPECS, STEP, BUILD_END } from './blueprint.js';

// Cada pieza visible tiene masa y cuerpo rígido. Ningún tween coloca ladrillos.
export function createBuildPhysics(Ammo) {
  let world, transform, frame = 0, owned = [], entries = [];
  const snapshots = SPECS.map(() => ({ visible: false, position: [0, 0, 0], quaternion: [0, 0, 0, 1] }));
  const own = x => { owned.push(x); return x; };
  const v = (x, y, z) => own(new Ammo.btVector3(x, y, z));
  function body(size, position, mass) {
    const shape = own(new Ammo.btBoxShape(v(size[0] / 2, size[1] / 2, size[2] / 2))); shape.setMargin(0.004);
    const pose = own(new Ammo.btTransform()); pose.setIdentity(); pose.setOrigin(v(...position));
    const motion = own(new Ammo.btDefaultMotionState(pose)), inertia = v(0, 0, 0);
    if (mass) shape.calculateLocalInertia(mass, inertia);
    const info = own(new Ammo.btRigidBodyConstructionInfo(mass, motion, shape, inertia));
    const rigid = own(new Ammo.btRigidBody(info));
    rigid.setFriction(0.9); rigid.setRestitution(0.025); rigid.setDamping(0.1, 0.8);
    // Guías de montaje: movimiento vertical libre, sin deriva ni vuelco lateral.
    // El apilado y la altura resultante siguen siendo contactos de Bullet.
    if (mass) { rigid.setLinearFactor(v(0, 1, 0)); rigid.setAngularFactor(v(0, 0, 0)); }
    return rigid;
  }
  function dispose() {
    if (world) for (const entry of entries) if (entry.active) world.removeRigidBody(entry.body);
    for (let i = owned.length - 1; i >= 0; i--) Ammo.destroy(owned[i]);
    owned = []; entries = []; world = null;
  }
  function reset() {
    dispose(); frame = 0;
    const configuration = own(new Ammo.btDefaultCollisionConfiguration());
    const dispatcher = own(new Ammo.btCollisionDispatcher(configuration));
    const broadphase = own(new Ammo.btDbvtBroadphase()), solver = own(new Ammo.btSequentialImpulseConstraintSolver());
    world = own(new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, configuration));
    world.setGravity(v(0, -18, 0));
    const ground = body([30, 0.2, 30], [0, -0.3, 0], 0);
    world.addRigidBody(ground); entries.push({ body: ground, active: true });
    for (const spec of SPECS) {
      const position = [...spec.position]; position[1] += spec.drop;
      entries.push({ body: body(spec.size, position, spec.mass), active: false, release: spec.release });
    }
    transform = own(new Ammo.btTransform());
  }
  function seek(seconds) {
    const target = Math.floor(Math.min(BUILD_END, Math.max(0, seconds)) / STEP + 1e-7);
    if (target < frame) reset();
    while (frame < target) {
      frame++;
      for (let i = 1; i < entries.length; i++) {
        const entry = entries[i];
        if (!entry.active && frame * STEP >= entry.release) {
          entry.active = true; world.addRigidBody(entry.body); entry.body.activate();
        }
      }
      world.stepSimulation(STEP, 0);
    }
    snapshots.forEach((snapshot, i) => {
      const entry = entries[i + 1]; snapshot.visible = entry.active;
      if (!entry.active) return;
      entry.body.getMotionState().getWorldTransform(transform);
      const p = transform.getOrigin(), q = transform.getRotation();
      snapshot.position = [p.x(), p.y(), p.z()]; snapshot.quaternion = [q.x(), q.y(), q.z(), q.w()];
    });
    return snapshots;
  }
  reset(); return { seek, reset, dispose };
}
