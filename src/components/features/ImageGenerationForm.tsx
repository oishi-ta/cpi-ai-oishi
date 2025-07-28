// src/components/features/ImageGenerationForm.tsx
import React, { useState } from 'react';
import { LuImage, LuRefreshCw, LuSettings } from 'react-icons/lu';
import type { ImageGenerationRequest } from '../../types/image';

interface ImageGenerationFormProps {
  onGenerate: (request: ImageGenerationRequest) => void;
  isGenerating: boolean;
}

const ImageGenerationForm: React.FC<ImageGenerationFormProps> = ({
  onGenerate,
  isGenerating
}) => {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [seed, setSeed] = useState<number | null>(null);
  const [numberOfImages, setNumberOfImages] = useState(1); // 枚数選択を追加

  const validSizes = [512, 768, 1024, 1152, 1216, 1344, 1536];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      alert('プロンプトを入力してください');
      return;
    }

    const request: ImageGenerationRequest = {
      prompt: prompt.trim(),
      negativePrompt: negativePrompt.trim() || undefined,
      width,
      height,
      seed: seed || undefined,
      numberOfImages // 枚数を追加
    };

    onGenerate(request);
  };

  const generateRandomSeed = () => {
    setSeed(Math.floor(Math.random() * 1000000));
  };

  return (
    <div className="image-generation-form">
      <form onSubmit={handleSubmit} className="form-container">
        {/* メインプロンプト */}
        <div className="form-group">
          <label htmlFor="prompt" className="form-label">
            <LuImage className="label-icon" />
            プロンプト *
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A beautiful sunset landscape with vibrant colors, highly detailed"
            className="form-textarea"
            rows={3}
            disabled={isGenerating}
            required
          />
          <div className="form-hint">
            生成したい画像を詳しく説明してください（英語推奨）- Nova Canvasで生成されます
          </div>
        </div>

        {/* ネガティブプロンプト */}
        <div className="form-group">
          <label htmlFor="negativePrompt" className="form-label">
            ネガティブプロンプト
          </label>
          <textarea
            id="negativePrompt"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="blurry, low quality, distorted"
            className="form-textarea"
            rows={2}
            disabled={isGenerating}
          />
          <div className="form-hint">
            画像に含めたくない要素を指定してください
          </div>
        </div>

        {/* 枚数選択 */}
        <div className="form-group">
          <label htmlFor="numberOfImages" className="form-label">
            生成枚数
          </label>
          <select
            id="numberOfImages"
            value={numberOfImages}
            onChange={(e) => setNumberOfImages(Number(e.target.value))}
            className="form-select"
            disabled={isGenerating}
          >
            <option value={1}>1枚</option>
            <option value={2}>2枚</option>
            <option value={3}>3枚</option>
            <option value={4}>4枚</option>
          </select>
          <div className="form-hint">
            一度に生成する画像の枚数を選択してください（最大4枚）
          </div>
        </div>

        {/* 詳細設定 */}
        <div className="form-group">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="advanced-toggle-button"
            disabled={isGenerating}
          >
            <LuSettings />
            詳細設定 {showAdvanced ? '▼' : '▶'}
          </button>
        </div>

        {showAdvanced && (
          <div className="advanced-settings">
            {/* サイズ設定 */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="width" className="form-label">幅</label>
                <select
                  id="width"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  className="form-select"
                  disabled={isGenerating}
                >
                  {validSizes.map(size => (
                    <option key={size} value={size}>{size}px</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="height" className="form-label">高さ</label>
                <select
                  id="height"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="form-select"
                  disabled={isGenerating}
                >
                  {validSizes.map(size => (
                    <option key={size} value={size}>{size}px</option>
                  ))}
                </select>
              </div>
            </div>

            {/* シード設定 */}
            <div className="form-group">
              <label htmlFor="seed" className="form-label">シード値</label>
              <div className="seed-input-group">
                <input
                  id="seed"
                  type="number"
                  value={seed || ''}
                  onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : null)}
                  placeholder="ランダム"
                  className="form-input"
                  disabled={isGenerating}
                  min="0"
                  max="999999"
                />
                <button
                  type="button"
                  onClick={generateRandomSeed}
                  className="seed-random-button"
                  disabled={isGenerating}
                  title="ランダムシード生成"
                >
                  <LuRefreshCw />
                </button>
              </div>
              <div className="form-hint">
                同じシード値で同じ画像を再生成できます
              </div>
            </div>
          </div>
        )}

        {/* 生成ボタン */}
        <button
          type="submit"
          className="generate-button"
          disabled={isGenerating || !prompt.trim()}
        >
          {isGenerating ? (
            <>
              <div className="loading-spinner" />
              Nova Canvasで生成中...
            </>
          ) : (
            <>
              <LuImage />
              Nova Canvasで画像生成
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default ImageGenerationForm;