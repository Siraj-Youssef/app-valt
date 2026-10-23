// Sessão do usuário (servidor, token, perfil) e chamadas HTTP de conta.
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

const _key = 'rumo:session';
const _serverPort = 8787;

// Definido no build: --dart-define=SERVER_URL=https://rumo.seudominio.com
const _builtInServer = String.fromEnvironment('SERVER_URL');

class User {
  User({required this.id, required this.email, required this.name});
  final String id, email, name;
  factory User.fromJson(Map<String, dynamic> j) => User(id: j['id'] as String, email: j['email'] as String, name: j['name'] as String);
  Map<String, dynamic> toJson() => {'id': id, 'email': email, 'name': name};
}

class Session {
  Session({required this.serverUrl, required this.token, required this.user});
  final String serverUrl, token;
  final User user;
  factory Session.fromJson(Map<String, dynamic> j) =>
      Session(serverUrl: j['serverUrl'] as String, token: j['token'] as String, user: User.fromJson((j['user'] as Map).cast<String, dynamic>()));
  Map<String, dynamic> toJson() => {'serverUrl': serverUrl, 'token': token, 'user': user.toJson()};
}

// Padrão: o servidor definido no build; senão, no navegador o mesmo host da página; no desktop, este PC.
String defaultServerUrl() {
  if (_builtInServer.isNotEmpty) return _builtInServer;
  if (kIsWeb) return 'http://${Uri.base.host}:$_serverPort';
  return 'http://localhost:$_serverPort';
}

Future<Session?> loadSession() async {
  final raw = (await SharedPreferences.getInstance()).getString(_key);
  return raw == null ? null : Session.fromJson((jsonDecode(raw) as Map).cast<String, dynamic>());
}

Future<void> saveSession(Session s) async => (await SharedPreferences.getInstance()).setString(_key, jsonEncode(s.toJson()));
Future<void> clearSession() async => (await SharedPreferences.getInstance()).remove(_key);

class AuthException implements Exception {
  AuthException(this.message);
  final String message;
  @override
  String toString() => message;
}

Future<Session> authenticate({required bool register, required String serverUrl, required String email, required String password, String? name}) async {
  final base = serverUrl.trim().replaceFirst(RegExp(r'/$'), '');
  http.Response res;
  try {
    res = await http
        .post(Uri.parse('$base/auth/${register ? 'register' : 'login'}'),
            headers: {'content-type': 'application/json'},
            body: jsonEncode({'email': email, 'password': password, if (register) 'name': name}))
        .timeout(const Duration(seconds: 12));
  } catch (_) {
    throw AuthException('Não consegui falar com o servidor em $base. Confira o endereço e se o aparelho está na mesma rede.');
  }
  Map<String, dynamic> json = {};
  try {
    json = (jsonDecode(utf8.decode(res.bodyBytes)) as Map).cast<String, dynamic>();
  } catch (_) {}
  if (res.statusCode >= 400) throw AuthException(json['message'] as String? ?? 'Erro ${res.statusCode}');
  return Session(serverUrl: base, token: json['token'] as String, user: User.fromJson((json['user'] as Map).cast<String, dynamic>()));
}

void logoutRemote(Session s) {
  http.post(Uri.parse('${s.serverUrl}/auth/logout'), headers: {'authorization': 'Bearer ${s.token}'}).ignore();
}
