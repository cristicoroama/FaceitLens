from django.contrib import admin
from django.urls import path, include

from tracker import stats

urlpatterns = [
    path("admin/", admin.site.urls),
    # Staff-only HTML page, so it sits outside /api/ and reuses the admin login.
    path("insights/", stats.dashboard, name="insights"),
    path("api/", include("tracker.urls")),
]
