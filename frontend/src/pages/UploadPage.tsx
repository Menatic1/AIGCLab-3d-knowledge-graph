import { useTabs } from '../context/TabContext';
import { Upload, Zap, ArrowRight, Sparkles } from 'lucide-react';
import FileUploader from '../components/upload/FileUploader';
import UploadProgress from '../components/upload/UploadProgress';
import { useKnowledge } from '../context/KnowledgeContext';
import { useAuth } from '../context/AuthContext';

export default function UploadPage() {
  const { documents, addDocument, triggerParse, loadSampleGraph, hasGraph, graph } = useKnowledge();
  const { openTab } = useTabs();
  const { user } = useAuth();

  if (user?.role !== 'teacher') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="sketch-card p-8 max-w-md text-center">
          <Upload size={34} className="mx-auto mb-4 text-sketch-orangeDeep" />
          <h2 className="text-xl font-bold text-ink handwritten mb-2">教师专属功能</h2>
          <p className="text-sm text-ink-light mb-5">学生账号暂不支持上传或解析课程文档，你仍可以浏览图谱、学习知识点并向 AI 助教提问。</p>
          <button onClick={() => openTab('graph')} className="sketch-btn-primary">返回知识图谱 <ArrowRight size={14} /></button>
        </div>
      </div>
    );
  }

  const handleFiles = (files: FileList) => {
    Array.from(files).forEach((f) => addDocument(f));
  };

  const handleParse = async (docId: string) => {
    await triggerParse(docId);
    setTimeout(() => openTab('graph'), 400);
  };

  return (
    <div className="space-y-5">
      {/* 页面标题 + 操作按钮 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl md:text-3xl font-bold text-ink handwritten">
          文档上传 · AI 构建知识图谱
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={loadSampleGraph} className="sketch-btn-secondary text-sm">
            <Zap size={14} /> 加载示例图谱
          </button>
          {hasGraph && (
            <button onClick={() => openTab('graph')} className="sketch-btn-primary text-sm">
              当前图谱 <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 上传区 + 进度 */}
        <div className="lg:col-span-2 space-y-4">
          <FileUploader onFiles={handleFiles} />
          <UploadProgress documents={documents} onParse={handleParse} />
        </div>

        {/* 已加载图谱卡 */}
        {hasGraph && graph && (
          <div className="lg:col-span-1">
            <div className="sketch-card p-5 bg-gradient-to-br from-sketch-green/10 via-paper-50 to-sketch-yellow/10 border-sketch-green/30 h-full flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-full bg-sketch-green/30 flex items-center justify-center">
                  <Sparkles size={15} className="text-sketch-greenDeep" />
                </div>
                <h3 className="font-bold text-ink">已加载图谱</h3>
              </div>
              <div className="text-sm text-ink space-y-1.5 mb-4">
                <div className="flex justify-between"><span className="text-ink-light">课程</span><b>{graph.courseName}</b></div>
                <div className="flex justify-between"><span className="text-ink-light">章节</span><b className="text-right">{graph.chapterName}</b></div>
                <div className="flex justify-between"><span className="text-ink-light">源文档</span><span className="text-right truncate max-w-[60%]">{graph.documentName}</span></div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-5 text-center">
                <div className="bg-paper-50 rounded-sketch-sm border border-ink/10 py-2.5">
                  <div className="text-lg font-bold text-sketch-blueDeep handwritten">{graph.nodes.length}</div>
                  <div className="text-[11px] text-ink-light">知识点</div>
                </div>
                <div className="bg-paper-50 rounded-sketch-sm border border-ink/10 py-2.5">
                  <div className="text-lg font-bold text-sketch-orangeDeep handwritten">{graph.relations.length}</div>
                  <div className="text-[11px] text-ink-light">关系</div>
                </div>
                <div className="bg-paper-50 rounded-sketch-sm border border-ink/10 py-2.5">
                  <div className="text-lg font-bold text-sketch-purple handwritten">
                    {new Set(graph.relations.map((r) => r.type)).size}
                  </div>
                  <div className="text-[11px] text-ink-light">类型</div>
                </div>
              </div>
              <button onClick={() => openTab('graph')} className="sketch-btn-success w-full text-sm mt-auto">
                探索 <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
