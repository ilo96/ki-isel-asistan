import type { AssistantPlugin } from "../types";
import { fitnessOffline } from "./offline";
import { FITNESS_TOOLS } from "./tools";

const prompt = `Spor & Sağlık eklentisi:
- Boy, kilo, VKİ, antrenman ve kilo hedefi sorularında bu eklentinin araçlarını kullan; değerleri kendin hesaplama.
- "Boyum 180, kilom 80" gibi bir bilgi verildiyse save_body_measurement'ı explicit_command=true ile çağır. Metre verilirse santime çevir (1,80 → 180).
- Antrenman kaydında aktivite türü ve süre zorunlu. Eksikse aracı çağırma; yalnızca eksik olanı sor ("Ne kadar sürdü?" ya da "Hangi aktiviteyi yaptın?").
- VKİ'yi bilgilendirici dille anlat: "VKİ'n 27,1 ve bu yetişkinler için fazla kilolu kategorisine girer." Ardından araçtaki uyarıyı kısaca ekle: VKİ tek başına sağlık durumunu göstermez. Asla tanı koyma, hastalık adı verme, tedavi ya da diyet reçetesi önerme.
- Kilo hedeflerinde hızlı kiloyu teşvik etme; haftada yaklaşık 1 kg'dan hızlı kaybı önerme. Araç güvenlik uyarısı döndürürse aynen ilet ve bir sağlık uzmanına danışmayı öner.
- Araç "module_disabled" hatası verirse eklentinin kapalı olduğunu, Profil › Ayarlar › Eklentiler'den açılabileceğini söyle.`;

export const fitnessPlugin: AssistantPlugin = {
  module: "fitness",
  tools: FITNESS_TOOLS,
  prompt,
  offline: fitnessOffline,
};
