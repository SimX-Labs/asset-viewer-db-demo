import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AppStateService } from '../../services/app-state.service';

@Component({
  selector: 'app-webgl-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (state.currentWebGLAssetId(); as assetId) {
      <aside class="webgl-sidebar">
        <div class="webgl-header">
          <span class="webgl-title">Unity Player: {{ assetName(assetId) }}</span>
          <button class="webgl-close" (click)="close()">✖</button>
        </div>
        <div class="unity-container">
          <iframe #unityFrame class="unity-iframe" [src]="iframeSrc"></iframe>
          <div class="message-log">
            <div class="log-title">Message Bus</div>
            <div class="log-content" [innerHTML]="logHtml"></div>
            <div class="dev-send-panel">
              <div class="log-title">Manual Send</div>
              <textarea [(ngModel)]="manualMessage" rows="3"></textarea>
              <button (click)="sendManual()">Send Message</button>
            </div>
          </div>
        </div>
      </aside>
    }
  `,
  styleUrl: './webgl-sidebar.component.scss',
})
export class WebglSidebarComponent implements OnInit, OnDestroy {
  readonly state = inject(AppStateService);
  private readonly sanitizer = inject(DomSanitizer);
  @ViewChild('unityFrame') unityFrame?: ElementRef<HTMLIFrameElement>;

  iframeSrc: SafeResourceUrl | null = null;
  logHtml = '<span class="muted">> Waiting for asset...</span>';
  manualMessage = '';
  private messageListener?: (event: MessageEvent) => void;

  constructor() {
    effect(() => {
      const assetId = this.state.currentWebGLAssetId();
      if (assetId) this.loadAsset(assetId);
    });
  }

  ngOnInit(): void {
    this.messageListener = (event: MessageEvent) => {
      if (event.data === 'UnityReady' && this.state.currentWebGLAssetId()) {
        this.sendPayload();
      }
    };
    window.addEventListener('message', this.messageListener);
  }

  ngOnDestroy(): void {
    if (this.messageListener) window.removeEventListener('message', this.messageListener);
  }

  assetName(id: string): string {
    return this.state.assetMap()[id]?.AssetName ?? id;
  }

  close(): void {
    this.iframeSrc = null;
    this.state.closeWebGLView();
  }

  loadAsset(assetId: string): void {
    this.iframeSrc = this.sanitizer.bypassSecurityTrustResourceUrl('WebGL/index.html');
    this.logHtml = `<span class="muted">> Preparing payload (${this.state.messageMode()})...</span><br>`;
    setTimeout(() => this.sendPayload(), 1500);
  }

  private sendPayload(): void {
    const assetId = this.state.currentWebGLAssetId();
    if (!assetId) return;
    const asset = this.state.assetMap()[assetId];
    if (!asset) return;

    let payload: object;
    if (this.state.messageMode() === 'package') {
      payload = { type: asset.AssetType, data: asset.Data };
    } else {
      payload = {
        Type: asset.AssetType,
        AssetAddress: asset.Data?.['AssetAddress'] ?? null,
      };
    }

    const iframe = this.unityFrame?.nativeElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(JSON.stringify(payload), '*');
      const pretty = JSON.stringify(payload, null, 2)
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      this.logHtml += `<span class="success">> Message Sent:</span><br><pre>${pretty}</pre>`;
    } else {
      this.logHtml += `<span class="error">> Error: Unity Frame not found.</span>`;
    }
  }

  sendManual(): void {
    const iframe = this.unityFrame?.nativeElement;
    if (!iframe?.contentWindow || !this.manualMessage) return;
    iframe.contentWindow.postMessage(this.manualMessage, '*');
    this.logHtml += `<br><span class="warn">> Manual Send:</span><br>${this.manualMessage}`;
    this.manualMessage = '';
  }
}
