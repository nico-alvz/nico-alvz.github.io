// A tiny, intentionally-limited interpreter for a subset of Arduino sketches.
// Supported: setup(), custom handler functions, attachInterrupt(), plus two
// ways to drive a pin — the beginner pinMode()/digitalWrite() API, and direct
// AVR port manipulation (DDRD/PORTD with (1 << n) bitmasks, including masks
// that OR several pins together in one register write). D2–D5 map onto
// PORTD bits 2–5, same as on a real Uno. No control flow, no loop(), no
// arithmetic beyond bitmasks — just enough for real interrupt-driven logic.

export const VALID_PINS = [2, 3, 4, 5];
export const PIN_LABELS = { 2: "Amarillo", 3: "Azul", 4: "Verde", 5: "Rojo" };

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function indexToLine(source, index) {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

function extractFunctions(source) {
  const functions = {};
  const re = /void\s+([A-Za-z_]\w*)\s*\(\s*\)\s*\{/g;
  let match;
  while ((match = re.exec(source))) {
    const name = match[1];
    const bodyStart = re.lastIndex;
    let depth = 1;
    let i = bodyStart;
    for (; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) {
      throw { line: indexToLine(source, match.index), message: `Llave sin cerrar en la función ${name}()` };
    }
    functions[name] = { body: source.slice(bodyStart, i), bodyStart, declLine: indexToLine(source, match.index) };
    re.lastIndex = i + 1;
  }
  return functions;
}

function splitStatements(body, bodyStart, source) {
  const statements = [];
  let cursor = 0;
  while (cursor <= body.length) {
    const semi = body.indexOf(";", cursor);
    const raw = semi === -1 ? body.slice(cursor) : body.slice(cursor, semi);
    const trimmed = raw.trim();
    if (trimmed) {
      const offsetInBody = cursor + raw.indexOf(trimmed[0]);
      statements.push({ text: trimmed, line: indexToLine(source, bodyStart + offsetInBody) });
    }
    if (semi === -1) break;
    cursor = semi + 1;
  }
  return statements;
}

const RE_PIN_MODE = /^pinMode\s*\(\s*(\d+)\s*,\s*(OUTPUT|INPUT|INPUT_PULLUP)\s*\)$/;
const RE_ATTACH_INTERRUPT = /^attachInterrupt\s*\(\s*(\d+)\s*,\s*([A-Za-z_]\w*)\s*,\s*(RISING|FALLING|CHANGE)\s*\)$/;
const RE_WRITE_LITERAL = /^digitalWrite\s*\(\s*(\d+)\s*,\s*(HIGH|LOW)\s*\)$/;
const RE_WRITE_TOGGLE = /^digitalWrite\s*\(\s*(\d+)\s*,\s*!\s*digitalRead\s*\(\s*(\d+)\s*\)\s*\)$/;
const RE_UNSUPPORTED = /^(if|for|while|switch)\s*\(/;

// Direct port manipulation on PORTD (D0–D7 = PORTD bits 0–7, so D2–D5 line
// up exactly with the model's 4 buttons). Each side of |=, &=~ and ^= can
// hold one or several "(1 << n)" terms OR-ed together.
// Parens are optional so both "(1 << 2)" (OR-chained multi-bit masks) and
// the common single-bit convention "~(1 << 2)" (no inner parens) both parse.
const MASK_TERM_RE = /\(?\s*1\s*<<\s*(\d+)\s*\)?/g;
const RE_DDR_SET = /^DDRD\s*\|=\s*(.+)$/;
const RE_DDR_CLEAR = /^DDRD\s*&=\s*~\s*\((.+)\)$/;
const RE_PORT_SET = /^PORTD\s*\|=\s*(.+)$/;
const RE_PORT_CLEAR = /^PORTD\s*&=\s*~\s*\((.+)\)$/;
const RE_PORT_TOGGLE = /^PORTD\s*\^=\s*(.+)$/;

function checkPin(pin, line) {
  if (!VALID_PINS.includes(pin)) {
    throw {
      line,
      message: `Pin ${pin} fuera de rango. Pines disponibles: D2 (Amarillo), D3 (Azul), D4 (Verde), D5 (Rojo).`,
    };
  }
}

function extractBits(expr, line) {
  const bits = [];
  MASK_TERM_RE.lastIndex = 0;
  let m;
  while ((m = MASK_TERM_RE.exec(expr))) {
    const pin = Number(m[1]);
    checkPin(pin, line);
    bits.push(pin);
  }
  if (!bits.length) {
    throw { line, message: `No se reconoce la máscara de bits: "${expr.trim()}".` };
  }
  return bits;
}

// Returns an array of {type, pin, value?} ops — a single statement can touch
// several pins at once via a combined bitmask (e.g. PORTD |= (1<<2)|(1<<3)).
function parseWriteStatement(text, line) {
  let m = text.match(RE_WRITE_LITERAL);
  if (m) {
    const pin = Number(m[1]);
    checkPin(pin, line);
    return [{ type: "write", pin, value: m[2] === "HIGH" }];
  }
  m = text.match(RE_WRITE_TOGGLE);
  if (m) {
    const pin = Number(m[1]);
    const readPin = Number(m[2]);
    if (pin !== readPin) {
      throw { line, message: `digitalRead(${readPin}) debe leer el mismo pin que se escribe (${pin}).` };
    }
    checkPin(pin, line);
    return [{ type: "toggle", pin }];
  }
  m = text.match(RE_PORT_CLEAR);
  if (m) return extractBits(m[1], line).map((pin) => ({ type: "write", pin, value: false }));
  m = text.match(RE_PORT_SET);
  if (m) return extractBits(m[1], line).map((pin) => ({ type: "write", pin, value: true }));
  m = text.match(RE_PORT_TOGGLE);
  if (m) return extractBits(m[1], line).map((pin) => ({ type: "toggle", pin }));
  return null;
}

// DDRD (data-direction register) statements only make sense in setup() —
// they configure pin direction, they don't return a write op.
function parseDirectionStatement(text, line) {
  let m = text.match(RE_DDR_CLEAR);
  if (m) return extractBits(m[1], line).map((pin) => ({ pin, mode: "INPUT" }));
  m = text.match(RE_DDR_SET);
  if (m) return extractBits(m[1], line).map((pin) => ({ pin, mode: "OUTPUT" }));
  return null;
}

export function parseProgram(source) {
  try {
    const clean = stripComments(source);
    const functions = extractFunctions(clean);

    if (!functions.setup) {
      return { ok: false, errors: [{ line: 1, message: "Falta la función setup()." }] };
    }

    if (functions.loop) {
      const loopStatements = splitStatements(functions.loop.body, functions.loop.bodyStart, clean);
      if (loopStatements.length) {
        return {
          ok: false,
          errors: [
            {
              line: loopStatements[0].line,
              message:
                "loop() con lógica no está soportado en este simulador — usá attachInterrupt() para reaccionar a los botones.",
            },
          ],
        };
      }
    }

    const errors = [];
    const interrupts = {};
    const setupWrites = [];
    const pins = {};

    const setupStatements = splitStatements(functions.setup.body, functions.setup.bodyStart, clean);
    for (const stmt of setupStatements) {
      const { text, line } = stmt;
      if (RE_UNSUPPORTED.test(text)) {
        errors.push({ line, message: `"${text.split("(")[0]}(...)" no está soportado — solo se permiten llamadas directas.` });
        continue;
      }
      let m = text.match(RE_PIN_MODE);
      if (m) {
        const pin = Number(m[1]);
        try {
          checkPin(pin, line);
        } catch (e) {
          errors.push(e);
          continue;
        }
        pins[pin] = m[2];
        continue;
      }
      m = text.match(RE_ATTACH_INTERRUPT);
      if (m) {
        const pin = Number(m[1]);
        const handlerName = m[2];
        try {
          checkPin(pin, line);
        } catch (e) {
          errors.push(e);
          continue;
        }
        if (!functions[handlerName]) {
          errors.push({ line, message: `La función "${handlerName}()" no está definida.` });
          continue;
        }
        interrupts[pin] = { handler: handlerName, edge: m[3] };
        continue;
      }
      try {
        const directions = parseDirectionStatement(text, line);
        if (directions) {
          directions.forEach((d) => {
            pins[d.pin] = d.mode;
          });
          continue;
        }
        const writes = parseWriteStatement(text, line);
        if (writes) {
          setupWrites.push(...writes);
          continue;
        }
      } catch (e) {
        errors.push(e);
        continue;
      }
      errors.push({ line, message: `No se reconoce la instrucción: "${text}".` });
    }

    const handlers = {};
    const usedHandlerNames = new Set(Object.values(interrupts).map((i) => i.handler));
    for (const name of usedHandlerNames) {
      const fn = functions[name];
      const statements = splitStatements(fn.body, fn.bodyStart, clean);
      const ops = [];
      for (const stmt of statements) {
        try {
          const writes = parseWriteStatement(stmt.text, stmt.line);
          if (writes) {
            ops.push(...writes);
          } else {
            errors.push({ line: stmt.line, message: `En ${name}(): instrucción no reconocida "${stmt.text}".` });
          }
        } catch (e) {
          errors.push(e);
        }
      }
      handlers[name] = ops;
    }

    if (errors.length) {
      errors.sort((a, b) => a.line - b.line);
      return { ok: false, errors };
    }

    return { ok: true, errors: [], pins, interrupts, handlers, setupWrites };
  } catch (e) {
    if (e && typeof e.line === "number") return { ok: false, errors: [e] };
    return { ok: false, errors: [{ line: 1, message: "Error de sintaxis inesperado." }] };
  }
}
