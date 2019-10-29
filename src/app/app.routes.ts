import {RouterModule, Routes} from '@angular/router';
import {MainComponent} from './main/main.component';
import {CompatibilityGuard} from './shared/compatibility.guard';
import {BrowserTestComponent} from './components/browser-test/browser-test.component';

const APP_ROUTES: Routes = [
  {path: '', component: MainComponent, canActivate: [CompatibilityGuard]},
  {path: 'test', component: BrowserTestComponent, canActivate: [CompatibilityGuard]},
  {path: '**', redirectTo: '/', pathMatch: 'full'}
];

export const routing = RouterModule.forRoot(APP_ROUTES);
