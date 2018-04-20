# deadcode

> **[EN]** Static analysis tool that finds unused exports and dead functions across your JavaScript and TypeScript codebase.
> **[FR]** Outil d'analyse statique qui trouve les exports inutilisés et les fonctions mortes dans votre base de code JavaScript et TypeScript.

---

## Features / Fonctionnalités

**[EN]**
- Scans all `.js`, `.ts`, `.jsx` and `.tsx` files recursively
- Detects named exports that are never imported anywhere in the project
- Ignores `default` and `module.exports` to avoid false positives
- Configurable ignore patterns (node_modules, dist, build excluded by default)
- Custom extension filter via `--extensions`
- JSON output mode for integration with CI or other tools
- Exits with code 1 when dead code is found (fail CI pipelines)
- No AST parser dependency — lightweight regex-based scanning

**[FR]**
- Parcourt récursivement tous les fichiers `.js`, `.ts`, `.jsx` et `.tsx`
- Détecte les exports nommés qui ne sont jamais importés dans le projet
- Ignore `default` et `module.exports` pour éviter les faux positifs
- Patterns d'ignorance configurables (node_modules, dist, build exclus par défaut)
- Filtre d'extension personnalisé via `--extensions`
- Mode de sortie JSON pour l'intégration CI ou d'autres outils
- Quitte avec le code 1 lorsque du code mort est trouvé (fait échouer les pipelines CI)
- Aucune dépendance à un parseur AST — scan léger basé sur les expressions régulières

---

## Installation

```bash
npm install -g @idirdev/deadcode
```

---

## CLI Usage / Utilisation CLI

```bash
# Scan current directory / Scanner le répertoire courant
deadcode

# Scan a specific project / Scanner un projet spécifique
deadcode ./src

# Only scan TypeScript files / Scanner uniquement les fichiers TypeScript
deadcode ./src --extensions .ts,.tsx

# Ignore additional directories / Ignorer des répertoires supplémentaires
deadcode . --ignore node_modules,dist,coverage,__tests__

# JSON output / Sortie JSON
deadcode ./src --format json

# Use in CI (exits 1 if dead code found) / Utiliser en CI (quitte 1 si code mort trouvé)
deadcode ./src && echo "Clean!"
```

### Example Output / Exemple de sortie

```
Dead Code Report

src/utils/format.js:14  function  formatCurrency
src/utils/format.js:31  function  parseDuration
src/api/helpers.ts:8    export    buildQueryString
src/components/Modal.jsx:22  export  ModalFooter

4 unused export(s)
```

```
# No dead code / Aucun code mort
No dead code found!
```

---

## API (Programmatic) / API (Programmation)

```js
const { findDeadCode, collectFiles } = require('@idirdev/deadcode');

// Find all unused named exports / Trouver tous les exports nommés inutilisés
const results = findDeadCode('./src', {
  extensions: ['.js', '.ts', '.jsx', '.tsx'],
  ignore: ['node_modules', 'dist', 'build', '__tests__'],
});

// Each result: { name, file, line, type }
results.forEach(r => {
  console.log(`${r.file}:${r.line}  ${r.type}  ${r.name}`);
});

if (results.length > 0) {
  console.log(results.length + ' unused export(s) found');
  process.exit(1);
}

// Collect files only / Collecter uniquement les fichiers
const files = collectFiles('./src', ['.ts', '.tsx'], ['node_modules', 'dist']);
console.log('Files scanned:', files.length);
```

---

## License

MIT — idirdev
