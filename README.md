# Navraklılar Torna – Gelişmiş Kollektör Çizim

Navraklılar Torna için müşteri ve proje bazlı kollektör tasarlama, teknik çizim oluşturma ve PDF/PNG çıktısı alma uygulaması.

## Teknoloji

- React ve TanStack Start (SPA)
- Supabase Auth ve PostgreSQL
- GitHub Pages üzerinde statik yayın

## Geliştirme

Bun 1.x ve Node.js 22 veya üzeri gerekir.

```sh
bun install
bun run dev
```

Üretim derlemesi:

```sh
bun run build
```

## Supabase yapılandırması

Tarayıcıda kullanılmak üzere Supabase proje adresi ve publishable/anon anahtarı `src/integrations/supabase/config.ts` içinde tanımlıdır. Bunlar herkese açık istemci bilgileridir; veritabanı güvenliği RLS politikalarıyla sağlanmalıdır.

İsteğe bağlı olarak `VITE_SUPABASE_URL` ve `VITE_SUPABASE_PUBLISHABLE_KEY` ortam değişkenleriyle derleme sırasında geçersiz kılınabilir. Service-role/secret anahtarı hiçbir zaman tarayıcıya veya GitHub Pages'e konulmamalıdır.

## Yayın

`.github/workflows/pages.yml` GitHub Pages için SPA derlemesini ve dağıtımını yönetir. Depo GitHub Pages için etkinleştirilmeli ve ücretsiz `github.io` barındırması için herkese açık olmalıdır.
