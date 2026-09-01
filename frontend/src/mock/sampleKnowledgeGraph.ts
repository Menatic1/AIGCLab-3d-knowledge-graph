import type { KnowledgeGraph, ChatMessage } from '../types';

// ==================== 知识点分类颜色映射 ====================
export const CATEGORY_META: Record<string, { label: string; color: string; bgColor: string }> = {
  foundation: { label: '基础概念', color: '#3f7ba0', bgColor: '#d7e6f2' },
  concept:    { label: '核心概念', color: '#5a9b5a', bgColor: '#dcebdc' },
  protocol:   { label: '协议',     color: '#d18040', bgColor: '#f5e0cc' },
  algorithm:  { label: '算法',     color: '#a68ac9', bgColor: '#e6dcf2' },
  device:     { label: '设备',     color: '#d98787', bgColor: '#f2dcdc' },
  application:{ label: '应用',     color: '#e8cf6a', bgColor: '#f5ecd0' },
};

// ==================== 关系类型元数据 ====================
export const RELATION_META: Record<string, { label: string; color: string; dash?: boolean }> = {
  contains:     { label: '包含关系', color: '#3f7ba0' },
  prerequisite: { label: '前置关系', color: '#d18040' },
  related:      { label: '相关关系', color: '#a89880', dash: true },
};

// ==================== 示例知识图谱：计算机网络 · 数据链路层 ====================
export const sampleKnowledgeGraph: KnowledgeGraph = {
  courseName: '计算机网络原理',
  chapterName: '第 3 章 数据链路层',
  documentName: '《计算机网络》谢希仁 第七版_ch3.pdf',
  extractedAt: new Date().toISOString(),
  nodes: [
    // ==== 基础 ====
    {
      id: 'n1', name: '数据链路层', category: 'foundation', importance: 5,
      description: 'OSI 七层模型中的第二层，负责节点到节点的数据可靠传输。',
      definition: '数据链路层是 OSI 参考模型的第二层，介于物理层和网络层之间。它将一条原始的、有差错的物理链路改造成对网络层来说是无差错的数据链路。',
      examples: ['以太网 MAC 层协议', '点对点协议 PPP'],
      resources: [
        { title: '教材 · 数据链路层概述', url: '#sec-3-1' },
        { title: 'MOOC · 链路层功能讲解', url: '#' },
      ],
    },
    {
      id: 'n2', name: '封装成帧', category: 'concept', importance: 4,
      description: '将网络层数据报前后添加首部和尾部构成一个帧。',
      definition: '封装成帧就是在一段数据的前后分别添加首部和尾部，构成一个帧。接收端通过首部和尾部的标记识别一个帧的开始和结束。',
      examples: ['首部 SOH=0x01 开始', '尾部 EOT=0x04 结束'],
      resources: [{ title: '帧封装过程动画演示', url: '#' }],
    },
    {
      id: 'n3', name: '透明传输', category: 'concept', importance: 4,
      description: '无论数据比特组合如何，都应能在链路上正确传输。',
      definition: '透明传输是指所传的数据中的任何比特组合都应当能够在链路上传输。如果某些控制字符在数据中出现，需要做转义处理。',
      examples: ['字符填充法', '字节填充'],
      resources: [{ title: '透明传输问题示例', url: '#' }],
    },
    {
      id: 'n4', name: '差错检测', category: 'concept', importance: 5,
      description: '检测传输过程中产生的比特差错。',
      definition: '数据链路层广泛使用循环冗余校验 CRC 进行差错检测。但差错检测只检测帧是否有差错，不纠正，有差错就丢弃。',
      examples: ['CRC 多项式校验', '奇偶校验'],
      resources: [{ title: 'CRC 计算步骤详解', url: '#' }],
    },
    {
      id: 'n5', name: '循环冗余校验 CRC', category: 'algorithm', importance: 5,
      description: '一种基于多项式除法的差错检测算法。',
      definition: '在发送端，将数据除以约定的生成多项式 G(x)，得到余数 FCS 附加在帧尾；接收端用相同 G(x) 除收到的数据，余数为 0 则无错。',
      examples: ['CRC-16: x^16+x^15+x^2+1', 'CRC-32 以太网标准'],
      resources: [
        { title: 'CRC 计算器在线工具', url: '#' },
        { title: '例题：手动计算 CRC', url: '#' },
      ],
    },
    {
      id: 'n6', name: '可靠传输', category: 'concept', importance: 4,
      description: '使数据链路层向上层提供可靠的、无差错的数据传输服务。',
      definition: '可靠传输是指发送端发送什么，接收端就收到什么，不出现差错、丢失、重复、乱序。主要通过确认和超时重传机制实现。',
      examples: ['TCP 的可靠传输', '停止等待协议'],
      resources: [{ title: '可靠传输原理图解', url: '#' }],
    },
    {
      id: 'n7', name: '停止等待协议', category: 'protocol', importance: 4,
      description: '每发送完一个分组就停止发送，等待对方确认。',
      definition: '发送端发送一个帧后，停止发送，等待接收端 ACK 确认。收到确认后再发下一个。若超时未收到 ACK，则重传。',
      examples: ['超时重传时间设定', '确认丢失与确认迟到'],
      resources: [{ title: '停止等待时序图', url: '#' }],
    },
    {
      id: 'n8', name: '连续 ARQ 协议', category: 'protocol', importance: 4,
      description: '允许连续发送多个分组，不必每发完一个就停下来等待确认。',
      definition: '发送方维持发送窗口，窗口内的帧可连续发送；接收方一般采用累积确认，对按序到达的最后一个分组发送确认。',
      examples: ['回退 N 帧 GBN', '滑动窗口'],
      resources: [{ title: '连续 ARQ 与停等对比', url: '#' }],
    },
    {
      id: 'n9', name: '滑动窗口', category: 'algorithm', importance: 5,
      description: '通过滑动窗口机制实现流量控制和可靠传输。',
      definition: '滑动窗口通过一个动态的窗口范围限制已发送但未确认的帧数量。发送窗口随确认滑动前移，接收窗口规定可接受的帧序号。',
      examples: ['发送窗口 WT=4', '接收窗口 WR=1（GBN）'],
      resources: [{ title: '滑动窗口可视化演示', url: '#' }],
    },
    {
      id: 'n10', name: '选择重传 ARQ', category: 'protocol', importance: 3,
      description: '只重传出现差错或超时的帧，而非所有后续帧。',
      definition: '选择重传协议接收窗口 WR>1，可以先收下发送窗口内序号正确但不按序的帧，等缺的帧收到后再一并交付上层。',
      examples: ['WR=WT=2^(n-1)'],
      resources: [{ title: 'GBN vs SR 对比表格', url: '#' }],
    },
    {
      id: 'n11', name: '点对点协议 PPP', category: 'protocol', importance: 4,
      description: '用户到 ISP 之间使用的数据链路层协议。',
      definition: 'PPP (Point-to-Point Protocol) 是目前使用最广泛的数据链路层协议之一，用于点对点链路上传输多种网络层协议的数据报。',
      examples: ['家庭宽带拨号连接', '同步/异步链路'],
      resources: [{ title: 'PPP 帧格式分析', url: '#' }],
    },
    {
      id: 'n12', name: '媒体接入控制 MAC', category: 'concept', importance: 5,
      description: '解决多个用户如何共享媒体（信道）的问题。',
      definition: '媒体接入控制（Medium Access Control）是广播信道上的核心问题，主要任务是协调各站点对共享信道的使用，避免或解决冲突。',
      examples: ['CSMA/CD', '令牌传递'],
      resources: [{ title: '信道分配策略分类', url: '#' }],
    },
    {
      id: 'n13', name: 'CSMA/CD 协议', category: 'protocol', importance: 5,
      description: '载波监听多点接入 / 碰撞检测，经典以太网使用。',
      definition: 'CSMA/CD: 多点接入 + 载波监听 + 碰撞检测。发前监听、边发边听、冲突退避、截断二进制指数退避。',
      examples: ['以太网 10BASE5', '争用期 51.2 μs'],
      resources: [
        { title: 'CSMA/CD 状态机', url: '#' },
        { title: '最小帧长推导', url: '#' },
      ],
    },
    {
      id: 'n14', name: '截断二进制指数退避', category: 'algorithm', importance: 4,
      description: '冲突后计算重传等待时间的算法。',
      definition: '从离散整数集合 {0,1,...,2^k-1} 中随机取一个数 r，重传等待时间 = r × 争用期。k = min(重传次数, 10)。',
      examples: ['第 1 次冲突：r∈{0,1}', '第 3 次冲突：r∈{0..7}'],
      resources: [{ title: '退避算法例题解析', url: '#' }],
    },
    {
      id: 'n15', name: '以太网 MAC 层', category: 'protocol', importance: 5,
      description: 'IEEE 802.3 标准定义的以太网媒体接入控制子层。',
      definition: '以太网 MAC 层负责封装成帧、差错检测、媒体接入控制。MAC 帧包含目的地址、源地址、类型/长度、数据、FCS 字段。',
      examples: ['MAC 地址 6 字节 48 位', '最小帧 64 字节，最大 1518 字节'],
      resources: [{ title: 'MAC 帧字段含义详解', url: '#' }],
    },
    {
      id: 'n16', name: 'MAC 地址', category: 'concept', importance: 4,
      description: '局域网中适配器的物理地址，用于链路层寻址。',
      definition: 'MAC 地址（物理地址）固化在网卡 ROM 中，共 48 位，前 24 位是厂商 OUI，后 24 位是厂商分配的序列号。',
      examples: ['00:1A:2B:3C:4D:5E', '广播地址 FF:FF:FF:FF:FF:FF'],
      resources: [{ title: 'MAC 地址查询工具', url: '#' }],
    },
    {
      id: 'n17', name: '以太网交换机', category: 'device', importance: 5,
      description: '链路层设备，根据 MAC 地址转发帧，隔绝冲突域。',
      definition: '以太网交换机内部维护 MAC 地址表（CAM 表），通过自学习算法动态建立端口与 MAC 的映射，转发时只转发到对应端口。',
      examples: ['24 口千兆交换机', '交换机自学习过程'],
      resources: [{ title: '交换机转发示例动画', url: '#' }],
    },
    {
      id: 'n18', name: '交换机自学习', category: 'algorithm', importance: 4,
      description: '交换机动态构建 MAC 地址表的过程。',
      definition: '当交换机收到一个帧，先记录源 MAC 地址与进入端口到地址表；然后按目的 MAC 查地址表转发，查不到就泛洪到其他所有端口。',
      examples: ['A→B 首次传输的学习过程'],
      resources: [{ title: '自学习步骤图解', url: '#' }],
    },
    {
      id: 'n19', name: '生成树协议 STP', category: 'protocol', importance: 3,
      description: '消除交换网络中的环路，防止广播风暴。',
      definition: 'STP (Spanning Tree Protocol) 通过在交换机之间交换 BPDU 信息，计算出一棵无环的树，阻塞冗余链路，同时在主链路故障时启用备份链路。',
      examples: ['根桥选举', '端口角色：根端口/指定端口/阻塞端口'],
      resources: [{ title: 'STP 拓扑变化过程', url: '#' }],
    },
    {
      id: 'n20', name: '虚拟局域网 VLAN', category: 'concept', importance: 4,
      description: '通过交换机将局域网划分为多个逻辑上独立的广播域。',
      definition: 'VLAN 通过在以太网帧中插入 VLAN 标签（802.1Q），实现同一交换机下不同端口间的二层隔离，从而缩小广播域，提升安全性。',
      examples: ['VLAN 10 研发部', 'VLAN 20 市场部', 'Trunk 链路'],
      resources: [{ title: 'VLAN 划分实验', url: '#' }],
    },
    {
      id: 'n21', name: '集线器', category: 'device', importance: 2,
      description: '物理层设备，所有端口共享同一冲突域。',
      definition: '集线器（Hub）工作在物理层，简单地把一个端口收到的信号放大后从其他所有端口转发出去，所有端口共享带宽和冲突域。',
      examples: ['10BASE-T 共享式集线器'],
      resources: [{ title: '集线器 vs 交换机对比', url: '#' }],
    },
    {
      id: 'n22', name: '网桥', category: 'device', importance: 2,
      description: '链路层设备，交换机的前身，连接多个网段。',
      definition: '网桥基于 MAC 地址转发帧，可分隔冲突域，但所有端口仍在一个广播域。现代交换机实质上是多端口网桥。',
      examples: ['透明网桥'],
      resources: [{ title: '透明网桥转发流程', url: '#' }],
    },
    {
      id: 'n23', name: 'HDLC 协议', category: 'protocol', importance: 2,
      description: '高级数据链路控制协议，面向比特的同步协议。',
      definition: 'HDLC (High-level Data Link Control) 是 ISO 制定的面向比特的链路控制规程，采用标志字段 01111110 定界，使用零比特填充实现透明传输。',
      examples: ['零比特插入/删除'],
      resources: [{ title: 'HDLC 帧结构', url: '#' }],
    },
    {
      id: 'n24', name: '零比特填充', category: 'algorithm', importance: 3,
      description: 'HDLC 和 PPP 中实现透明传输的方法。',
      definition: '发送端发现 5 个连续的 1 时，立即在其后填入一个 0；接收端在连续的 5 个 1 之后，将紧跟的一个 0 删除，还原成原来的比特流。',
      examples: ['原始: 111111  →  发送: 1111101'],
      resources: [{ title: '零比特填充示例演示', url: '#' }],
    },
    {
      id: 'n25', name: '字节填充', category: 'algorithm', importance: 3,
      description: 'PPP 异步链路中实现透明传输的转义方法。',
      definition: '当信息字段中出现与标志字段相同的字节时，将其替换成转义字节 ESC + 异或 0x20 后的字节；接收端做反向还原。',
      examples: ['0x7E → 0x7D 0x5E', '0x7D → 0x7D 0x5D'],
      resources: [{ title: 'PPP 字符填充步骤', url: '#' }],
    },
    {
      id: 'n26', name: '载波监听多路访问 CSMA', category: 'protocol', importance: 3,
      description: '发前先监听信道，空闲才发送的一类媒体接入协议。',
      definition: 'CSMA (Carrier Sense Multiple Access) 每个站点在发送前先侦听信道。根据监听策略可分为：1-坚持、非坚持、p-坚持 CSMA。',
      examples: ['1-坚持 CSMA: 空闲立即发', 'p-坚持 CSMA: 空闲以概率 p 发'],
      resources: [{ title: '三种 CSMA 吞吐对比', url: '#' }],
    },
  ],
  relations: [
    // ====== 包含关系（蓝色）======
    { id: 'r1', source: 'n1', target: 'n2',  type: 'contains', label: '包含' },
    { id: 'r2', source: 'n1', target: 'n3',  type: 'contains', label: '包含' },
    { id: 'r3', source: 'n1', target: 'n4',  type: 'contains', label: '包含' },
    { id: 'r4', source: 'n1', target: 'n6',  type: 'contains', label: '包含' },
    { id: 'r5', source: 'n1', target: 'n11', type: 'contains', label: '包含' },
    { id: 'r6', source: 'n1', target: 'n12', type: 'contains', label: '包含' },
    { id: 'r7', source: 'n4', target: 'n5',  type: 'contains', label: '包含' },
    { id: 'r8', source: 'n6', target: 'n7',  type: 'contains', label: '包含' },
    { id: 'r9', source: 'n6', target: 'n8',  type: 'contains', label: '包含' },
    { id: 'r10', source: 'n8', target: 'n9', type: 'contains', label: '包含' },
    { id: 'r11', source: 'n8', target: 'n10', type: 'contains', label: '包含' },
    { id: 'r12', source: 'n12', target: 'n13', type: 'contains', label: '包含' },
    { id: 'r13', source: 'n12', target: 'n26', type: 'contains', label: '包含' },
    { id: 'r14', source: 'n13', target: 'n14', type: 'contains', label: '包含' },
    { id: 'r15', source: 'n1', target: 'n15', type: 'contains', label: '包含' },
    { id: 'r16', source: 'n15', target: 'n16', type: 'contains', label: '包含' },
    { id: 'r17', source: 'n1', target: 'n17', type: 'contains', label: '包含' },
    { id: 'r18', source: 'n17', target: 'n18', type: 'contains', label: '包含' },
    { id: 'r19', source: 'n17', target: 'n19', type: 'contains', label: '包含' },
    { id: 'r20', source: 'n17', target: 'n20', type: 'contains', label: '包含' },
    { id: 'r21', source: 'n1', target: 'n23', type: 'contains', label: '包含' },
    { id: 'r22', source: 'n23', target: 'n24', type: 'contains', label: '包含' },
    { id: 'r23', source: 'n3', target: 'n25', type: 'contains', label: '包含' },

    // ====== 前置关系（橙色实线）======
    { id: 'p1', source: 'n2', target: 'n3',  type: 'prerequisite', label: '前置于' },
    { id: 'p2', source: 'n2', target: 'n4',  type: 'prerequisite', label: '前置于' },
    { id: 'p3', source: 'n4', target: 'n6',  type: 'prerequisite', label: '前置于' },
    { id: 'p4', source: 'n6', target: 'n7',  type: 'prerequisite', label: '前置于' },
    { id: 'p5', source: 'n7', target: 'n8',  type: 'prerequisite', label: '前置于' },
    { id: 'p6', source: 'n8', target: 'n9',  type: 'prerequisite', label: '前置于' },
    { id: 'p7', source: 'n9', target: 'n10', type: 'prerequisite', label: '前置于' },
    { id: 'p8', source: 'n12', target: 'n13', type: 'prerequisite', label: '前置于' },
    { id: 'p9', source: 'n13', target: 'n14', type: 'prerequisite', label: '前置于' },
    { id: 'p10', source: 'n13', target: 'n15', type: 'prerequisite', label: '前置于' },
    { id: 'p11', source: 'n15', target: 'n16', type: 'prerequisite', label: '前置于' },
    { id: 'p12', source: 'n16', target: 'n17', type: 'prerequisite', label: '前置于' },
    { id: 'p13', source: 'n17', target: 'n18', type: 'prerequisite', label: '前置于' },
    { id: 'p14', source: 'n18', target: 'n19', type: 'prerequisite', label: '前置于' },
    { id: 'p15', source: 'n3', target: 'n25', type: 'prerequisite', label: '前置于' },
    { id: 'p16', source: 'n25', target: 'n11', type: 'prerequisite', label: '前置于' },
    { id: 'p17', source: 'n24', target: 'n23', type: 'prerequisite', label: '前置于' },

    // ====== 相关关系（灰色虚线）======
    { id: 'x1', source: 'n5',  target: 'n15', type: 'related', label: '相关于' },
    { id: 'x2', source: 'n9',  target: 'n11', type: 'related', label: '相关于' },
    { id: 'x3', source: 'n13', target: 'n26', type: 'related', label: '相关于' },
    { id: 'x4', source: 'n17', target: 'n21', type: 'related', label: '相关于' },
    { id: 'x5', source: 'n17', target: 'n22', type: 'related', label: '相关于' },
    { id: 'x6', source: 'n19', target: 'n20', type: 'related', label: '相关于' },
    { id: 'x7', source: 'n23', target: 'n11', type: 'related', label: '相关于' },
    { id: 'x8', source: 'n24', target: 'n25', type: 'related', label: '相关于' },
    { id: 'x9', source: 'n10', target: 'n9',  type: 'related', label: '相关于' },
  ],
};

// ==================== 示例问答（Mock）====================
export interface QAPair { keywords: string[]; answer: string; refs: string[] }

export const qaKnowledgeBase: QAPair[] = [
  {
    keywords: ['数据链路层', '作用', '功能', '是什么'],
    answer: '数据链路层是 OSI 参考模型的第二层，它的主要作用是在原始、有差错的物理链路上，向网络层提供透明的、可靠的数据传输服务。核心功能包括：① 封装成帧；② 透明传输；③ 差错检测（CRC）；④ 可靠传输（停止等待/ARQ）；⑤ 媒体接入控制（共享信道）。',
    refs: ['n1', 'n2', 'n4', 'n6', 'n12'],
  },
  {
    keywords: ['CRC', '循环冗余', '校验', '怎么算'],
    answer: 'CRC（循环冗余校验）计算步骤：① 发送端与接收端约定一个生成多项式 G(x)（如 CRC-32）。② 设 G(x) 的阶是 r，在数据末尾加 r 个 0。③ 用模 2 除法，将加 0 后的数据除以 G(x)，得到余数 r 位，即 FCS。④ 把 FCS 附加在帧尾发出。⑤ 接收端用同样的 G(x) 去除收到的数据，若余数为 0 则判定无差错。',
    refs: ['n4', 'n5'],
  },
  {
    keywords: ['停止等待', '连续ARQ', '区别', '对比'],
    answer: '停止等待协议：发送端每发一个帧就停下等 ACK，收到再发下一帧。优点是简单，缺点是信道利用率低。连续 ARQ 协议：引入滑动窗口，可连续发送多个帧而不必逐个等待；接收端采用累积确认。优点是信道利用率高、吞吐大；缺点是若某个帧出错，回退 N 协议会重传该帧及后续所有帧（GBN）。',
    refs: ['n7', 'n8', 'n9'],
  },
  {
    keywords: ['CSMA/CD', '载波监听', '碰撞检测', '流程'],
    answer: 'CSMA/CD 的工作流程可以概括为四步：① 发前先听：监听信道是否空闲。② 空闲就发，忙则等待。③ 边发边听：发送期间持续检测碰撞。④ 发现冲突，立即停止发送，发送人为干扰信号，然后执行"截断二进制指数退避"算法等待一段随机时间后重传。注意：无线局域网使用 CSMA/CA，不使用 CD。',
    refs: ['n13', 'n14', 'n26'],
  },
  {
    keywords: ['交换机', '集线器', '区别', '对比'],
    answer: '集线器（Hub）工作在物理层，所有端口共享同一冲突域和带宽，半双工；交换机工作在数据链路层，每个端口是独立的冲突域，可全双工，并通过 MAC 地址表精确转发帧，不共享带宽。因此交换机吞吐更高、延迟更小、冲突更少。',
    refs: ['n17', 'n21'],
  },
  {
    keywords: ['VLAN', '虚拟局域网', '作用', '为什么用'],
    answer: 'VLAN（虚拟局域网）的作用是在不改变物理布线的情况下，通过在帧中插入 802.1Q 标签，将一个物理局域网从逻辑上划分成多个广播域。这样做的好处：① 缩小广播域，减少广播流量；② 提升安全性，不同 VLAN 默认二层隔离；③ 按部门/职能分组，管理灵活。',
    refs: ['n20'],
  },
  {
    keywords: ['STP', '生成树', '为什么需要'],
    answer: '交换网络中为了可靠性常常部署冗余链路，但是冗余链路会引入"二层环路"，造成广播风暴、MAC 地址表不稳定等严重问题。STP（生成树协议）的作用就是：通过在交换机之间交换 BPDU，计算出一棵无环的树，逻辑上阻塞某些冗余端口；当主链路故障时，被阻塞端口可自动切换到转发状态，在保证无环的同时提供冗余备份。',
    refs: ['n19'],
  },
  {
    keywords: ['选择重传', 'SR', 'GBN', '区别'],
    answer: 'GBN（回退 N 帧）：接收窗口 WR=1，只能接受按序到达的帧，一旦某个帧出错，其后到达的所有帧即使正确也要丢弃，重传量较大。SR（选择重传）：WR>1，可以先缓存序号正确但乱序的帧，只重传真正出错或超时的帧，提高了信道利用率；但代价是接收端需要缓存空间，窗口上限 WT=WR≤2^(n-1)。',
    refs: ['n10', 'n8', 'n9'],
  },
  {
    keywords: ['PPP', '点对点', '特点'],
    answer: 'PPP（Point-to-Point Protocol）是点对点链路上最常用的数据链路层协议，特点：① 简单；② 支持多种网络层协议（IP、IPX 等）；③ 支持同步/异步链路；④ 具备差错检测（不纠错）；⑤ 提供身份认证（PAP/CHAP）；⑥ 使用字节填充或零比特填充实现透明传输。广泛用于家庭宽带拨号接入 ISP。',
    refs: ['n11', 'n25'],
  },
  {
    keywords: ['MAC地址', '物理地址', '作用'],
    answer: 'MAC 地址是固化在网卡 ROM 中的 48 位物理地址，数据链路层使用它寻址。前 24 位 OUI 标识厂商，后 24 位由厂商唯一分配。交换机通过 MAC 地址表将帧转发到正确的端口。注意：MAC 地址是本地有效地址，跨网络传输时使用 IP 地址寻址，MAC 地址只在同一局域网内生效。',
    refs: ['n16', 'n15', 'n17'],
  },
];

export const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: '你好！我是基于「计算机网络 · 数据链路层」课程知识图谱的智能助教 🤖。你可以问我任何关于本章的问题，例如：\n• 数据链路层的主要功能是什么？\n• 停止等待和连续 ARQ 有什么区别？\n• 交换机和集线器有什么区别？\n• 什么是 VLAN？',
    timestamp: new Date().toISOString(),
  },
];
