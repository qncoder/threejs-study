export function createNodeInfoSections(node) {
  if (!node) return [];

  return [
    {
      key: 'basic',
      title: '基础信息',
      items: [
        { label: '名称', value: node.displayName || node.name || '(未命名)' },
        { label: '类型', value: node.type || 'Object3D' },
        { label: '路径', value: node.path || '' },
      ],
    },
    {
      key: 'hierarchy',
      title: '层级信息',
      items: [
        { label: '父节点', value: node.parentName || '(无)' },
        { label: '子节点', value: String(node.childCount ?? 0) },
        { label: '树深度', value: String(node.depth ?? 0) },
      ],
    },
    {
      key: 'role',
      title: '角色信息',
      items: roleItems(node.mechanismRole),
    },
    {
      key: 'geometry',
      title: '几何信息',
      items: [
        { label: '网格', value: node.isMesh ? '是' : '否' },
        { label: '几何体', value: node.geometryType || '无' },
        { label: '材质', value: node.materialNames?.length ? node.materialNames.join(', ') : '无' },
      ],
    },
    {
      key: 'transform',
      title: '变换信息',
      items: [
        { label: '局部位置', value: formatArray(node.position) },
        { label: '局部旋转', value: `${formatArray(node.rotationDeg)}°` },
        { label: '局部缩放', value: formatArray(node.scale) },
        { label: '世界坐标', value: formatArray(node.worldPosition) },
      ],
    },
  ];
}

function roleItems(role) {
  if (!role) {
    return [{ label: '机构角色', value: '未识别' }];
  }

  return [
    { label: '机构角色', value: `${role.label} / ${role.type}，可信度：${role.confidence}` },
    { label: '作用判断', value: role.description },
    { label: '调节建议', value: role.controlHint },
  ];
}

function formatArray(value) {
  return Array.isArray(value) ? value.join(', ') : '';
}
