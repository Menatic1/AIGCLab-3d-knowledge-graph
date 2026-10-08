const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MMD_DIR = path.join(__dirname, '..', 'docs', '撰写材料', '配图-mmd');
const OUT_DIR = path.join(__dirname, '..', 'docs', '撰写材料', '配图-code');

fs.mkdirSync(OUT_DIR, { recursive: true });

const files = [
  '系统技术框架图',
  '通信流程图',
  '知识图谱与AI处理框架',
  '知识抽取流程图',
  'RAG问答流程图',
  '前端系统框架图',
  '后端系统框架图',
  '项目甘特图',
  '学习路径推荐图',
];

// 配置：白色背景、2x缩放、自定义主题
const config = {
  theme: 'base',
  themeVariables: {
    primaryColor: '#eff6ff',
    primaryTextColor: '#1e3a8a',
    primaryBorderColor: '#3b82f6',
    lineColor: '#64748b',
    secondaryColor: '#f0fdf4',
    tertiaryColor: '#fef3c7',
    fontFamily: '"Microsoft YaHei", "SimHei", sans-serif',
    fontSize: '14px',
  },
  flowchart: {
    curve: 'basis',
    padding: 15,
    nodeSpacing: 50,
    rankSpacing: 60,
  },
  gantt: {
    barHeight: 30,
    barGap: 4,
    topPadding: 30,
    rightPadding: 30,
    gridLineStartPadding: 30,
    fontSize: 12,
  },
};

const configFile = path.join(MMD_DIR, 'mmdc-config.json');
fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

console.log('批量渲染 Mermaid 图表...\n');

let ok = 0, fail = 0;
for (const f of files) {
  const input = path.join(MMD_DIR, `${f}.mmd`);
  const output = path.join(OUT_DIR, `${f}.png`);
  
  if (!fs.existsSync(input)) {
    console.log(`✗ 源文件不存在: ${f}`);
    fail++;
    continue;
  }
  
  try {
    execSync(`npx @mermaid-js/mermaid-cli -i "${input}" -o "${output}" -c "${configFile}" -s 2 -b white`, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
      timeout: 60000,
    });
    const stats = fs.statSync(output);
    console.log(`✓ ${f}.png (${(stats.size/1024).toFixed(1)} KB)`);
    ok++;
  } catch (e) {
    console.log(`✗ ${f} 渲染失败: ${e.message.split('\n')[0]}`);
    fail++;
  }
}

console.log(`\n完成: ${ok} 成功, ${fail} 失败`);
