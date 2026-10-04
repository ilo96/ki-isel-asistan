/*
 * Mağaza uygulamasının web görünümü dosya indiremez. Dosya sunucudan (oturum çereziyle)
 * alınır, telefonun geçici klasörüne yazılır ve paylaşım menüsü açılır; kullanıcı oradan
 * Dosyalar'a kaydeder ya da istediği uygulamaya gönderir.
 */
export async function shareDownload(url: string) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`İndirme başarısız: ${res.status}`);
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "vantrel-veriler.txt";
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);
  const { uri } = await Filesystem.writeFile({
    path: name,
    data: await res.text(),
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({ title: name, files: [uri] });
}
