import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const tmpJson = `/tmp/payments_${Date.now()}.json`;
  const tmpXls  = `/tmp/relatorio_${Date.now()}.xlsx`;
  const tmpPy   = `/tmp/gerar_${Date.now()}.py`;

  try {
    const { paymentsJson, scriptB64 } = req.body;

    writeFileSync(tmpJson, paymentsJson);

    const script = Buffer.from(scriptB64, 'base64').toString('utf8');
    const scriptWithOutput = script.replace(
      'out = "/tmp/relatorio_exec.xlsx"',
      `out = "${tmpXls}"`
    );
    writeFileSync(tmpPy, scriptWithOutput);

    execSync(`python3 "${tmpPy}" < "${tmpJson}"`, { timeout: 30000 });

    if (!existsSync(tmpXls)) {
      return res.status(500).json({ error: 'Excel não foi gerado' });
    }

    const xlsBytes = readFileSync(tmpXls);
    const xlsB64 = xlsBytes.toString('base64');

    res.status(200).json({ xlsB64 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    [tmpJson, tmpXls, tmpPy].forEach(f => { try { if(existsSync(f)) unlinkSync(f); } catch(_){} });
  }
}
