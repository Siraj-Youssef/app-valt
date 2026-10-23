// Datas como chaves locais 'AAAA-MM-DD' (sem fuso), semana começando na segunda.
const weekdayShort = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const weekdayLetter = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const weekdayLong = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

String _p(int n) => n.toString().padLeft(2, '0');

String toKey(DateTime d) => '${d.year}-${_p(d.month)}-${_p(d.day)}';

DateTime fromKey(String key) {
  final p = key.split('-').map(int.parse).toList();
  return DateTime(p[0], p[1], p[2]);
}

String todayKey() => toKey(DateTime.now());

String addDays(String key, int n) {
  final d = fromKey(key);
  return toKey(DateTime(d.year, d.month, d.day + n));
}

// 0 = segunda ... 6 = domingo
int weekdayOf(String key) => fromKey(key).weekday - 1;

List<String> weekKeys(String key) {
  final monday = addDays(key, -weekdayOf(key));
  return List.generate(7, (i) => addDays(monday, i));
}

List<String> monthKeys(int year, int month) {
  final days = DateTime(year, month + 1, 0).day;
  return List.generate(days, (i) => toKey(DateTime(year, month, i + 1)));
}

List<String> rangeKeys(String from, String to) {
  final out = <String>[];
  for (var k = from; k.compareTo(to) <= 0; k = addDays(k, 1)) {
    out.add(k);
  }
  return out;
}

int dayOfMonth(String key) => int.parse(key.substring(8, 10));
