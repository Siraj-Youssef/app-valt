// Identidade "Rumo": preto e vermelho, minimalista. Um único vermelho chapado (sem gradientes nem brilho),
// branco e cinzas para o resto. Tipografia: Space Grotesk (títulos e números) + Inter (texto).
import 'package:flutter/material.dart';

class C {
  static const bg = Color(0xFF0A0A0A);
  static const surface = Color(0xFF141414);
  static const surfaceAlt = Color(0xFF1F1F1F);
  static const line = Color(0xFF242424);
  static const ink = Color(0xFFF5F5F5);
  static const inkDim = Color(0xFFA3A3A3);
  static const inkFaint = Color(0xFF5E5E5E);
  static const primary = Color(0xFFE5302B);
  static const primarySoft = Color(0xFF2A100F);
  static const onPrimary = Color(0xFFFFFFFF);
  static const danger = Color(0xFFFF5A4F);
}

const kDisplay = 'SpaceGrotesk';
const kBody = 'Inter';

TextStyle display(double size, {FontWeight weight = FontWeight.w600, Color color = C.ink, double? spacing}) =>
    TextStyle(fontFamily: kDisplay, fontSize: size, fontWeight: weight, color: color, letterSpacing: spacing, height: 1.1);

TextStyle body(double size, {FontWeight weight = FontWeight.w400, Color color = C.ink, double? spacing, TextDecoration? deco}) =>
    TextStyle(fontFamily: kBody, fontSize: size, fontWeight: weight, color: color, letterSpacing: spacing, decoration: deco, decorationColor: color);

ThemeData buildTheme() {
  final base = ThemeData(brightness: Brightness.dark, useMaterial3: true, fontFamily: kBody);
  return base.copyWith(
    scaffoldBackgroundColor: C.bg,
    colorScheme: const ColorScheme.dark(
      primary: C.primary,
      onPrimary: C.onPrimary,
      surface: C.surface,
      onSurface: C.ink,
      error: C.danger,
    ),
    textTheme: base.textTheme.apply(bodyColor: C.ink, displayColor: C.ink, fontFamily: kBody),
    dividerColor: C.line,
    dividerTheme: const DividerThemeData(color: C.line, thickness: 1, space: 1),
    splashFactory: InkSparkle.splashFactory,
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: C.bg,
      hintStyle: body(16, color: C.inkFaint),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: C.line)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: C.inkDim)),
    ),
    textSelectionTheme: const TextSelectionThemeData(cursorColor: C.primary, selectionColor: C.primarySoft, selectionHandleColor: C.primary),
    bottomSheetTheme: const BottomSheetThemeData(backgroundColor: C.surface, modalBackgroundColor: C.surface, surfaceTintColor: Colors.transparent),
    snackBarTheme: SnackBarThemeData(backgroundColor: C.surfaceAlt, contentTextStyle: body(14)),
  );
}
