import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { LoginComponent } from './login.component';
import { environment } from '../../../../environments/environment';

describe('LoginComponent error handling', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }
      ]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    component.form.setValue({ email: 'user@example.com', password: 'whatever123' });
  });

  afterEach(() => httpMock.verify());

  it('shows the backend message on a 401 (bad credentials)', () => {
    component.submit();
    httpMock
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({ message: 'Invalid email or password.' }, { status: 401, statusText: 'Unauthorized' });

    expect(component.errorMessage()).toBe('Invalid email or password.');
  });

  it('shows a connection error - not "Invalid email or password" - when the request never reaches the server (status 0, e.g. CORS)', () => {
    component.submit();
    httpMock
      .expectOne(`${environment.apiUrl}/auth/login`)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(component.errorMessage()).toBe('Unable to connect to the server. Please try again.');
  });

  it('shows a generic server error - not "Invalid email or password" - on a 500', () => {
    component.submit();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush(null, { status: 500, statusText: 'Server Error' });

    expect(component.errorMessage()).toBe('Something went wrong on our end. Please try again later.');
  });
});
