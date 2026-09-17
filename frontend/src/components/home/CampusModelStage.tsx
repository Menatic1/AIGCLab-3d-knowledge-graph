import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { LucideIcon } from 'lucide-react';
import type { TabKind } from '../../context/TabContext';

type CampusCard = {
  kind: TabKind;
  title: string;
  desc: string;
  icon: LucideIcon;
};

type Props = {
  cards: CampusCard[];
  onOpen: (kind: TabKind) => void;
};

const colors = ['#3f7ba0', '#8d70b3', '#d18040', '#5a9b5a', '#b66d8f'];
const hotspotClasses = ['hotspot-1', 'hotspot-2', 'hotspot-3', 'hotspot-4', 'hotspot-5'];

export default function CampusModelStage({ cards, onOpen }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e8eef0');
    scene.fog = new THREE.Fog('#e8eef0', 8, 20);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(7.2, 6.8, 7.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 5.2;
    controls.maxDistance = 12;
    controls.minPolarAngle = Math.PI * 0.22;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.target.set(0, 0.15, 0);

    scene.add(new THREE.HemisphereLight('#fffaf0', '#8495a1', 2.0));
    const key = new THREE.DirectionalLight('#fff6dc', 4.2);
    key.position.set(4, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#7bb8c8', 2.1);
    rim.position.set(-5, 4, -4);
    scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(5.2, 64),
      new THREE.MeshStandardMaterial({ color: '#dce4e2', roughness: 0.92, metalness: 0.05 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.45;
    ground.receiveShadow = true;
    scene.add(ground);

    const accentRings = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.55 + i * 0.28, 0.012, 8, 96),
        new THREE.MeshBasicMaterial({ color: i === 1 ? '#d08b31' : '#3f7ba0', transparent: true, opacity: 0.42 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.42 + i * 0.01;
      accentRings.add(ring);
    }
    scene.add(accentRings);

    let frame = 0;
    let disposed = false;
    const loader = new GLTFLoader();
    loader.load('/models/campus.glb', (gltf) => {
      if (disposed) return;
      const model = gltf.scene;
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = true;
        object.receiveShadow = true;
        const source = Array.isArray(object.material) ? object.material[0] : object.material;
        const material = source.clone() as THREE.MeshStandardMaterial;
        material.color = new THREE.Color('#f2eee4');
        material.roughness = 0.46;
        material.metalness = 0.42;
        material.envMapIntensity = 0.7;
        object.material = material;
        const edgeMaterial = new THREE.LineBasicMaterial({ color: '#53636a', transparent: true, opacity: 0.2 });
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(object.geometry, 22), edgeMaterial);
        edges.renderOrder = 2;
        object.add(edges);
      });

      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = 4.7 / Math.max(size.x, size.y, size.z);
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -center.y * scale - 0.15, -center.z * scale);
      model.rotation.y = -0.35;
      model.rotation.x = -0.04;
      scene.add(model);
    }, undefined, (error) => {
      console.error('无法加载工作台模型', error);
    });

    const resize = () => {
      const width = mount.clientWidth || 1;
      const height = mount.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const render = () => {
      if (disposed) return;
      controls.update();
      accentRings.rotation.y += 0.0008;
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material.dispose();
      });
    };
  }, []);

  return (
    <div className="campus-stage">
      <div className="campus-model" ref={mountRef} aria-label="可旋转的课程展馆模型" />
      <div className="campus-stage-label"><span>COURSE CAMPUS</span><b>可拖拽旋转 · 滚轮缩放</b></div>
      <div className="campus-zone-overlay" aria-label="功能场馆入口">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <button
              type="button"
              key={card.kind}
              className={`campus-zone-hotspot ${hotspotClasses[index % hotspotClasses.length]}`}
              style={{ '--hotspot-color': colors[index % colors.length] } as React.CSSProperties}
              onClick={() => onOpen(card.kind)}
            >
              <span className="hotspot-number">O{index + 1}</span>
              <span className="hotspot-icon"><Icon size={17} strokeWidth={2.2} /></span>
              <span className="hotspot-copy"><strong>{card.title}</strong><small>{card.desc}</small></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
