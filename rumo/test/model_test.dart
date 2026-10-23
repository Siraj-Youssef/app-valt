import 'package:flutter_test/flutter_test.dart';
import 'package:rumo/data/store.dart';
import 'package:rumo/logic/dates.dart';
import 'package:rumo/logic/model.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  late Store store;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    store = Store();
    await store.load('teste');
  });

  void habit(String id, int points, {List<int> days = const [0, 1, 2, 3, 4, 5, 6], String start = '2026-10-01'}) =>
      store.put('tasks', id, {'title': id, 'icon': '•', 'points': points, 'repeat': 'weekly', 'weekdays': days, 'startDate': start});
  void done(String id, String date, int points) =>
      store.put('completions', completionId(id, date), {'taskId': id, 'date': date, 'done': true, 'points': points});

  test('datas: semana começa na segunda e meses têm o tamanho certo', () {
    expect(weekdayOf('2026-10-22'), 3); // quinta
    expect(weekKeys('2026-10-22').first, '2026-10-19');
    expect(monthKeys(2026, 2).length, 28);
    expect(addDays('2026-12-31', 1), '2027-01-01');
  });

  test('marco do dia, pontos e tarefas do dia', () {
    store.put('settings', 'goals', {'daily': [20, 20, 20, 20, 20, 0, 0]});
    habit('ler', 10);
    habit('correr', 15, days: [0, 2, 4]);
    done('ler', '2026-10-22', 10);
    final m = Model.of(store);
    expect(m.tasksFor('2026-10-22').map((t) => t.id), ['ler']); // quinta: correr não aparece
    expect(m.pointsOn('2026-10-22'), 10);
    expect(m.metOn('2026-10-22'), isFalse);
    done('correr', '2026-10-21', 15);
    done('ler', '2026-10-21', 10);
    expect(Model.of(store).metOn('2026-10-21'), isTrue);
  });

  test('sequência ignora dias livres e não zera hoje', () {
    store.put('settings', 'profile', {'name': 'T', 'startDate': '2026-10-15'});
    store.put('settings', 'goals', {'daily': [10, 10, 10, 10, 10, 0, 0]});
    habit('ler', 10);
    for (final d in ['2026-10-16', '2026-10-19', '2026-10-20', '2026-10-21']) {
      done('ler', d, 10);
    }
    // 15 (qui) não batido; 16 (sex) batido; 17-18 fim de semana livre; 19-21 batidos; 22 (hoje) ainda não.
    final s = Model.of(store).streaks('2026-10-22');
    expect(s.current, 4);
    expect(s.best, 4);
  });

  test('projeção do mês reproduz a conta do vídeo (50 pts num dia de meta 45 → 111%)', () {
    store.put('settings', 'profile', {'name': 'T', 'startDate': '2026-10-20'});
    store.put('settings', 'goals', {'daily': [60, 45, 40, 60, 60, 0, 0]});
    habit('x', 50, start: '2026-10-20');
    done('x', '2026-10-20', 50); // terça
    final mo = Model.of(store).month(2026, 10, '2026-10-20');
    expect(mo.goal, 4 * 60 + 4 * 45 + 4 * 40 + 5 * 60 + 5 * 60); // outubro/2026
    expect((mo.pace * 100).round(), 111);
  });

  test('LWW: versão remota mais antiga não sobrescreve a local; outbox só sai com ack da mesma versão', () {
    store.put('settings', 'goals', {'daily': [60, 0, 0, 0, 0, 0, 0]});
    final local = store.cols['settings']!['goals']!;
    store.applyRemote([
      {'col': 'settings', 'id': 'goals', 'data': {'daily': [5, 0, 0, 0, 0, 0, 0]}, 'updatedAt': local.updatedAt - 1000, 'deviceId': 'zzz', 'deleted': false, 'seq': 7},
    ]);
    expect(Model.of(store).daily.first, 60);
    expect(store.lastSeq, 7);

    final sent = store.pendingOps();
    store.put('settings', 'goals', {'daily': [70, 0, 0, 0, 0, 0, 0]}); // editado enquanto o lote viajava
    store.ackOps(sent);
    expect(store.outbox.length, 1); // a edição nova continua pendente
  });
}
