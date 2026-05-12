/**
 * ASR（语音识别）抽象层
 *
 * H5：Web Speech API SpeechRecognition（Chrome/Safari 支持）
 * 小程序：wx.getRecorderManager → 录音 → 调后端 ASR API
 *
 * 接口：startRecording() → Promise<string> 返回转写文本
 */

/** 检测浏览器是否支持 Web Speech API */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * 使用 Web Speech API 录音并转写
 * 返回识别到的文本
 *
 * @param lang 语言，默认 zh-CN
 * @param onInterim 中间结果回调（可选，用于实时显示）
 * @returns 最终识别文本
 */
export function startRecording(opts?: {
  lang?: string;
  onInterim?: (text: string) => void;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      reject(new Error("浏览器不支持语音识别"));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = opts?.lang ?? "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let finalTranscript = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (opts?.onInterim && (finalTranscript || interim)) {
        opts.onInterim(finalTranscript + interim);
      }
    };

    recognition.onerror = (event) => {
      reject(new Error(`语音识别错误: ${event.error}`));
    };

    recognition.onend = () => {
      resolve(finalTranscript);
    };

    recognition.start();
  });
}
