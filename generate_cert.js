const selfsigned = require('selfsigned');
const fs = require('fs');

async function genereazaCertificate() {
    console.log('⏳ Generare certificate (poate dura cateva secunde)...');

    try {
        // Folosim 'await' pentru a aștepta generarea
        // Atributele null lasă biblioteca să genereze default-uri sigure
        const pems = await selfsigned.generate(null, { days: 365 });

        // Scriem fișierele
        fs.writeFileSync('private-key.pem', pems.private);
        fs.writeFileSync('certificate.pem', pems.cert);

        console.log('✅ Gata! Fișierele private-key.pem și certificate.pem au fost create cu succes.');

    } catch (err) {
        console.error("❌ A apărut o eroare:", err);
    }
}

genereazaCertificate();