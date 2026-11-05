package expo.modules.backgroundrestriction

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Spec 082 D2 (smoke T101): "Permitir uso em segundo plano" desligado põe o app em
// "Restricted packages" e o AlarmManager SEGURA o alarme exato do crítico (medido no moto g06,
// Android 15: alarme 16:30 vencido e não entregue). Só este fato — nenhum dado de saúde.
class BackgroundRestrictionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BackgroundRestriction")

    // null = não se aplica (API < 28, sem a API) ou leitura indisponível.
    Function("isBackgroundRestricted") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return@Function null
      val context = appContext.reactContext ?: return@Function null
      val am = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
        ?: return@Function null
      am.isBackgroundRestricted
    }
  }
}
