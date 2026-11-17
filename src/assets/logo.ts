// Gerçek Navraklılar Torna logosu uygulamanın kendi dosyalarında durur (public/logo/).
// BASE_URL, GitHub Pages alt dizinini ("/gelismis-kollektor-cizimi1/") otomatik ekler.
export const logoUrl = `${import.meta.env.BASE_URL}logo/navraklilar-logo.png`;
/** PDF için küçültülmüş (810 px) kopya: PDF dosyası ~850 KB yerine ~330 KB olur; paylaşım eklentileri küçük dosyayı daha güvenilir aktarır. */
export const pdfLogoUrl = `${import.meta.env.BASE_URL}logo/navraklilar-logo-pdf.png`;
