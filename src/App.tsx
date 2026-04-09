/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Settings, Download, Type, Square, Scissors, Layers, Info, AlertCircle, RefreshCw, Sparkles, Upload, Image as ImageIcon, Loader2, ZoomIn, ZoomOut, Maximize, FileImage, MessageSquare, Database, Activity, ChevronRight, History, Shield, Palette, Zap, Brain, Search, Globe } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Stencil-friendly font from Google Fonts
const STENCIL_FONT = "'Big Shoulders Stencil Text', cursive";

export default function App() {
  const [activeTab, setActiveTab] = useState<'raw' | 'ai'>('ai');
  const [rawSvg, setRawSvg] = useState('');
  const [aiSvg, setAiSvg] = useState('');
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState('mylar-4mil');
  const [selectedAgent, setSelectedAgent] = useState<'architect' | 'stylist' | 'optimizer'>('architect');
  const [agentLevels, setAgentLevels] = useState({ architect: 1, stylist: 1, optimizer: 1 });
  const [showLevelUp, setShowLevelUp] = useState<string | null>(null);
  const [history, setHistory] = useState<{id: string, svg: string, timestamp: number}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const agents = {
    architect: {
      name: 'The Architect',
      icon: Shield,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      description: 'Focuses on structural integrity and perfect bridging.',
      instruction: 'You are a master structural engineer for stencils. Your priority is physical integrity, perfect bridging, and laser-cutter compatibility. Ensure every part is physically connected.'
    },
    stylist: {
      name: 'The Stylist',
      icon: Palette,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
      description: 'Focuses on aesthetics and artistic line work.',
      instruction: 'You are a stencil artist. Your priority is aesthetic balance, artistic flair, and expressive line work while maintaining stencil functionality. Focus on the visual impact.'
    },
    optimizer: {
      name: 'The Optimizer',
      icon: Zap,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/20',
      description: 'Focuses on node reduction and cutting speed.',
      instruction: 'You are a computational geometry expert. Your priority is minimizing path complexity, reducing node count, and maximizing material usage efficiency. Keep paths as simple as possible.'
    }
  };

  const materials = {
    'mylar-4mil': { name: 'Mylar (4mil)', kerf: 0.15, bridge: 1.5 },
    'mylar-7mil': { name: 'Mylar (7mil)', kerf: 0.20, bridge: 2.0 },
    'vinyl': { name: 'Adhesive Vinyl', kerf: 0.05, bridge: 0.5 },
    'cardboard': { name: 'Cardboard (2mm)', kerf: 0.40, bridge: 3.0 },
  };

  useEffect(() => {
    const savedHistory = localStorage.getItem('stencil_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    const savedLevels = localStorage.getItem('agent_levels');
    if (savedLevels) setAgentLevels(JSON.parse(savedLevels));
  }, []);

  useEffect(() => {
    localStorage.setItem('stencil_history', JSON.stringify(history.slice(0, 10)));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('agent_levels', JSON.stringify(agentLevels));
  }, [agentLevels]);

  const stats = useMemo(() => {
    const svg = activeTab === 'ai' ? aiSvg : rawSvg;
    if (!svg) return { paths: 0, nodes: 0 };
    const paths = (svg.match(/<path/g) || []).length + (svg.match(/<circle/g) || []).length + (svg.match(/<rect/g) || []).length;
    const nodes = (svg.match(/[0-9.]+/g) || []).length;
    return { paths, nodes };
  }, [activeTab, aiSvg, rawSvg]);

  const handleAiAction = async (mode: 'new' | 'refine' | 'search', file?: File) => {
    setIsAiLoading(true);
    setAiError(null);

    try {
      let contents: any[] = [];
      let tools: any[] = [];
      
      if (mode === 'new' && file) {
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        contents = [
          { inlineData: { mimeType: file.type, data: base64Data } },
          { text: "Analyze this image and create a professional-grade SVG stencil version of it. Return ONLY the SVG code." }
        ];
      } else if (mode === 'refine') {
        contents = [
          { text: `Current SVG: ${aiSvg}` },
          { text: `Refinement Request: ${refinementPrompt}. Modify the SVG based on this request. Ensure it remains a valid, cuttable stencil. Return ONLY the SVG code.` }
        ];
      } else if (mode === 'search') {
        contents = [
          { text: `Search the web for high-quality, high-contrast images of "${searchQuery}" that are suitable for use as stencils. Based on the best visual references you find, generate a professional-grade SVG stencil. Return ONLY the SVG code.` }
        ];
        tools = [{ googleSearch: {} }];
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents,
        config: {
          tools,
          systemInstruction: `${agents[selectedAgent].instruction} 
            
            CURRENT AGENT PROFICIENCY LEVEL: ${agentLevels[selectedAgent]}
            As your level increases, you become more sophisticated in your ${selectedAgent === 'architect' ? 'structural' : selectedAgent === 'stylist' ? 'artistic' : 'optimization'} techniques.
            
            STRICT REQUIREMENTS:
            1. PRECISION: Clean paths, minimal nodes.
            2. CONNECTIVITY: Implement bridges for islands.
            3. GEOMETRY: High clarity, no self-intersections.
            4. FORMAT: Return ONLY raw SVG code, no markdown, no text.
            5. VIEWBOX: '0 0 800 400'.`,
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 8192,
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT' as any, threshold: 'BLOCK_NONE' as any },
            { category: 'HARM_CATEGORY_HATE_SPEECH' as any, threshold: 'BLOCK_NONE' as any },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any, threshold: 'BLOCK_NONE' as any },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_NONE' as any },
          ],
        }
      });

      const text = response.text || '';
      const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/);
      if (svgMatch) {
        const newSvg = svgMatch[0];
        setAiSvg(newSvg);
        setHistory(prev => [{ id: Date.now().toString(), svg: newSvg, timestamp: Date.now() }, ...prev]);
        
        // Evolve agent
        setAgentLevels(prev => {
          const newLevel = Math.min(prev[selectedAgent] + 0.2, 10);
          if (Math.floor(newLevel) > Math.floor(prev[selectedAgent])) {
            setShowLevelUp(agents[selectedAgent].name);
            setTimeout(() => setShowLevelUp(null), 3000);
          }
          return { ...prev, [selectedAgent]: newLevel };
        });

        if (mode === 'refine') setRefinementPrompt('');
      } else {
        throw new Error("Invalid AI response format.");
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI operation failed.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const currentSvg = useMemo(() => {
    if (activeTab === 'ai') return aiSvg;
    return rawSvg;
  }, [activeTab, aiSvg, rawSvg]);

  const downloadAsJpeg = () => {
    if (!currentSvg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    const svgBlob = new Blob([currentSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = 1600; // High res
      canvas.height = 800;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const jpegUrl = canvas.toDataURL('image/jpeg', 0.9);
      const link = document.createElement('a');
      link.download = `stencil-${Date.now()}.jpg`;
      link.href = jpegUrl;
      link.click();
      
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const svgProvider = () => currentSvg;

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-[#e0e0e0] font-sans flex flex-col">
      {/* Top Navigation Bar */}
      <nav className="h-14 border-b border-white/10 bg-[#111] flex items-center px-6 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#FFD700] rounded-sm flex items-center justify-center text-black font-black italic">S</div>
          <span className="font-bold tracking-tight text-sm uppercase">StencilForge <span className="text-white/40 font-normal italic">v2.2</span></span>
        </div>
        
        <div className="flex bg-black/40 p-1 rounded-md border border-white/5">
          <button 
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-1.5 text-xs font-medium rounded transition-all ${activeTab === 'ai' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/60'}`}
          >
            <Sparkles className="w-3 h-3 inline-block mr-2" />
            AI ASSISTANT
          </button>
          <button 
            onClick={() => setActiveTab('raw')}
            className={`px-4 py-1.5 text-xs font-medium rounded transition-all ${activeTab === 'raw' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/60'}`}
          >
            <Scissors className="w-3 h-3 inline-block mr-2" />
            RAW SVG
          </button>
        </div>

          <div className="flex items-center gap-4">
            <button className="text-white/40 hover:text-white transition-colors">
              <Settings className="w-4 h-4" />
            </button>
            <div className="h-4 w-[1px] bg-white/10" />
            <div className={`flex items-center gap-2 text-[10px] font-mono ${process.env.GEMINI_API_KEY ? 'text-green-500' : 'text-red-500'}`}>
              <div className={`w-1.5 h-1.5 ${process.env.GEMINI_API_KEY ? 'bg-green-500 animate-pulse' : 'bg-red-500'} rounded-full`} />
              {process.env.GEMINI_API_KEY ? 'AI_ENGINE_READY' : 'API_KEY_MISSING'}
            </div>
          </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Controls */}
        <aside className="w-80 border-r border-white/10 bg-[#151515] flex flex-col">
          <div className="p-6 flex-1 overflow-y-auto space-y-8">
            
            {activeTab === 'ai' && (
              <div className="space-y-6">
                {/* Agent Selection */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <Brain className="w-3 h-3" /> Active AI Agent
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(agents) as Array<keyof typeof agents>).map((key) => {
                      const AgentIcon = agents[key].icon;
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedAgent(key)}
                          className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${selectedAgent === key ? `${agents[key].bg} ${agents[key].border} border-opacity-100` : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                        >
                          <AgentIcon className={`w-5 h-5 ${selectedAgent === key ? agents[key].color : 'text-white/20'}`} />
                          <div className="text-[8px] font-bold uppercase tracking-tighter text-center">
                            {agents[key].name.split(' ')[1]}
                          </div>
                          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${agents[key].color.replace('text', 'bg')} transition-all duration-1000`} 
                              style={{ width: `${(agentLevels[key] / 10) * 100}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className={`p-3 rounded border text-[10px] leading-relaxed ${agents[selectedAgent].bg} ${agents[selectedAgent].border}`}>
                    <span className={`font-bold ${agents[selectedAgent].color}`}>{agents[selectedAgent].name}:</span> {agents[selectedAgent].description}
                    <div className="mt-2 flex justify-between items-center text-[9px] opacity-60">
                      <span>Proficiency Level</span>
                      <span className="font-mono">LVL {agentLevels[selectedAgent].toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <Globe className="w-3 h-3" /> Web Search Stencil
                  </label>
                  <div className="relative">
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchQuery && handleAiAction('search')}
                      className="w-full bg-black/60 border border-white/10 rounded p-3 text-xs focus:border-[#FFD700]/50 outline-none transition-colors pr-10"
                      placeholder="Search for images (e.g. 'Wolf head', 'Lotus flower')..."
                    />
                    <button 
                      onClick={() => handleAiAction('search')}
                      disabled={!searchQuery || isAiLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-white/40 hover:text-[#FFD700] transition-colors disabled:opacity-30"
                    >
                      {isAiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <Sparkles className="w-3 h-3" /> New Stencil Analysis
                  </label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-video border-2 border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#FFD700]/30 hover:bg-white/5 transition-all group"
                  >
                    {isAiLoading && !aiSvg ? (
                      <Loader2 className="w-8 h-8 text-[#FFD700] animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-white/20 group-hover:text-[#FFD700]/50 transition-colors" />
                        <div className="text-center">
                          <p className="text-xs font-medium">Upload Image</p>
                          <p className="text-[10px] text-white/30">PNG, JPG up to 10MB</p>
                        </div>
                      </>
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={(e) => e.target.files?.[0] && handleAiAction('new', e.target.files[0])}
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                {aiSvg && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#FFD700] flex items-center gap-2">
                      <MessageSquare className="w-3 h-3" /> Refine with AI
                    </label>
                    <div className="relative">
                      <textarea 
                        value={refinementPrompt}
                        onChange={(e) => setRefinementPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAiAction('refine')}
                        className="w-full bg-black/60 border border-white/10 rounded p-3 text-xs focus:border-[#FFD700]/50 outline-none transition-colors resize-none h-20 pr-10"
                        placeholder="e.g. 'Make the bridges thicker' or 'Simplify the outer border'..."
                      />
                      <button 
                        onClick={() => handleAiAction('refine')}
                        disabled={!refinementPrompt || isAiLoading}
                        className="absolute bottom-2 right-2 p-1.5 bg-[#FFD700] text-black rounded hover:scale-105 transition-transform disabled:opacity-30 disabled:scale-100"
                      >
                        {isAiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <Database className="w-3 h-3" /> Material Library
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(materials).map(([key, mat]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedMaterial(key)}
                        className={`p-2 text-[10px] border rounded text-left transition-all ${selectedMaterial === key ? 'bg-[#FFD700] border-[#FFD700] text-black font-bold' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30'}`}
                      >
                        {mat.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <Activity className="w-3 h-3" /> Path Statistics
                  </label>
                  <div className="bg-black/40 rounded border border-white/5 p-3 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[9px] text-white/30 uppercase">Path Count</div>
                      <div className="text-sm font-mono text-[#FFD700]">{stats.paths}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-white/30 uppercase">Node Density</div>
                      <div className="text-sm font-mono text-[#FFD700]">{stats.nodes}</div>
                    </div>
                  </div>
                </div>

                {history.length > 0 && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                      <History className="w-3 h-3" /> Recent History
                    </label>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                      {history.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setAiSvg(item.svg)}
                          className="w-full p-2 bg-white/5 border border-white/5 rounded text-[9px] text-white/40 hover:bg-white/10 hover:text-white transition-all text-left flex justify-between items-center"
                        >
                          <span>Stencil_{item.id.slice(-4)}</span>
                          <span>{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {aiError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-red-200/70 leading-relaxed">{aiError}</p>
                  </div>
                )}

                <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-md">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">
                    <Info className="w-3 h-3" /> How it works
                  </div>
                  <p className="text-[10px] text-blue-200/50 leading-relaxed">
                    Upload a logo, sketch, or photo. Our AI will analyze the shapes and generate a cuttable SVG stencil with proper bridging.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'raw' && (
              <div className="space-y-3 h-full flex flex-col">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                  <Scissors className="w-3 h-3" /> SVG Source
                </label>
                <textarea 
                  value={rawSvg}
                  onChange={(e) => setRawSvg(e.target.value)}
                  className="flex-1 w-full bg-black/40 border border-white/10 rounded p-3 text-[10px] font-mono focus:border-[#FFD700]/50 outline-none transition-colors resize-none"
                  placeholder="Paste <svg> here..."
                />
              </div>
            )}
          </div>

          <div className="p-4 bg-black/40 border-t border-white/10">
            <div className="flex items-center gap-2 text-[10px] text-white/40">
              <Info className="w-3 h-3" />
              <span>Vector Stencil Engine</span>
            </div>
          </div>
        </aside>

        {/* Main Canvas Area */}
        <main className="flex-1 bg-[#0f0f0f] relative overflow-hidden flex flex-col">
          {/* Canvas Header */}
          <div className="h-10 border-b border-white/5 bg-[#111] flex items-center px-4 justify-between">
            <div className="flex items-center gap-4 text-[10px] font-mono text-white/30">
              <span>CANVAS_01</span>
              <span>800x400mm</span>
              <div className="h-3 w-[1px] bg-white/10 mx-1" />
              <button 
                onClick={downloadAsJpeg}
                disabled={!currentSvg || isAiLoading}
                className="flex items-center gap-1.5 hover:text-[#FFD700] transition-colors disabled:opacity-30 disabled:hover:text-white/30"
              >
                <FileImage className="w-3 h-3" />
                DOWNLOAD_JPEG
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 ${activeTab === 'ai' ? 'bg-blue-500' : 'bg-yellow-500'} rounded-full`} />
              <span className="text-[10px] font-mono text-white/30 uppercase">
                {activeTab === 'ai' ? 'AI Analysis Mode' : 'Draft Mode'}
              </span>
            </div>
          </div>

          {/* The Actual Canvas */}
          <div className="flex-1 relative overflow-hidden bg-[#0a0a0a]">
            {isAiLoading ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#0f0f0f]">
                <Loader2 className="w-12 h-12 text-[#FFD700] animate-spin" />
                <div className="text-center">
                  <p className="text-sm font-bold text-white uppercase tracking-widest">Analyzing Image</p>
                  <p className="text-[10px] text-white/40 font-mono">GEMINI_VISION_ENGINE // PROCESSING...</p>
                </div>
              </div>
            ) : (
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={8}
                centerOnInit={true}
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <>
                    <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
                      <button 
                        onClick={() => zoomIn()}
                        className="p-2 bg-black/60 border border-white/10 rounded hover:bg-black hover:border-[#FFD700]/50 transition-all text-white/60 hover:text-[#FFD700]"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => zoomOut()}
                        className="p-2 bg-black/60 border border-white/10 rounded hover:bg-black hover:border-[#FFD700]/50 transition-all text-white/60 hover:text-[#FFD700]"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => resetTransform()}
                        className="p-2 bg-black/60 border border-white/10 rounded hover:bg-black hover:border-[#FFD700]/50 transition-all text-white/60 hover:text-[#FFD700]"
                        title="Reset View"
                      >
                        <Maximize className="w-4 h-4" />
                      </button>
                    </div>

                    <TransformComponent
                      wrapperClassName="!w-full !h-full cursor-grab active:cursor-grabbing"
                      contentClassName="!w-full !h-full flex items-center justify-center"
                    >
                      <div className="relative group">
                        {/* Grid Background Overlay */}
                        <div className="absolute inset-0 pointer-events-none" 
                          style={{ 
                            backgroundImage: `
                              linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
                              linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px),
                              linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px),
                              linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)
                            `,
                            backgroundSize: '20px 20px, 20px 20px, 100px 100px, 100px 100px'
                          }} 
                        />
                        
                        <div className="bg-white shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-sm overflow-hidden border border-white/10">
                          <div 
                            className="w-[800px] h-[400px]"
                            dangerouslySetInnerHTML={{ __html: currentSvg || '<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f9f9f9" /><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#ccc">NO CONTENT</text></svg>' }} 
                          />
                        </div>

                        {/* Measurement Indicators */}
                        <div className="absolute -top-6 left-0 right-0 flex justify-between text-[10px] font-mono text-white/20">
                          <span>0mm</span>
                          <span>800mm</span>
                        </div>
                        <div className="absolute top-0 bottom-0 -left-6 flex flex-col justify-between text-[10px] font-mono text-white/20">
                          <span>0mm</span>
                          <span>400mm</span>
                        </div>
                      </div>
                    </TransformComponent>
                  </>
                )}
              </TransformWrapper>
            )}
          </div>

          {/* Status Bar */}
          <div className="h-8 border-t border-white/5 bg-[#111] flex items-center px-4 justify-between text-[9px] font-mono text-white/20">
            <div className="flex gap-4">
              <span>X: 402.12</span>
              <span>Y: 198.45</span>
              <span>Z: 0.00</span>
            </div>
            <div className="flex gap-4">
              <span className="text-green-500/50">SVG_READY</span>
              <span>SCALE: 1:1</span>
            </div>
          </div>
        </main>
      </div>

      {/* Global Overlays */}
      {showLevelUp && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-[#FFD700] text-black px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border-2 border-black/10">
            <Brain className="w-5 h-5 animate-bounce" />
            <div className="text-sm font-bold uppercase tracking-tighter">
              {showLevelUp} Evolved to Level {Math.floor(agentLevels[selectedAgent as keyof typeof agentLevels])}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
