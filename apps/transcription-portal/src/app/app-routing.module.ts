import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BrowserTestComponent } from './components/browser-test/browser-test.component';
import { LoadingComponent } from './pages/loading/loading.component';
import { MainComponent } from './pages/main/main.component';
import { CompatibilityGuard } from './shared/compatibility.guard';

const routes: Routes = [
  { path: 'loading', component: LoadingComponent },
  {
    path: '',
    component: MainComponent,
    canActivate: [CompatibilityGuard],
  },
  {
    path: 'test',
    component: BrowserTestComponent,
    canActivate: [],
  },
  { path: '**', redirectTo: '/', pathMatch: 'full' },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      defaultQueryParamsHandling: 'merge',
      initialNavigation: 'enabledBlocking',
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
